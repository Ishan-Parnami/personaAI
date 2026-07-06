import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { retrieveExcerpts } from "@/lib/retrieval";
import { buildSystemPrompt } from "@/lib/promptBuilder";
import { manageContext } from "@/lib/contextManager";
import { withFallback, AllKeysExhaustedError } from "@/lib/gemini/withFallback";
import { checkRateLimit } from "@/lib/rateLimiter";
import { validateChatRequest } from "@/lib/guardrails/schema";
import { logGuardrailEvent, truncateForLog, type GuardrailOutcome } from "@/lib/guardrails/logger";
import { checkInputSafety } from "@/lib/guardrails/inputGate";

const CHAT_MODEL = "gemini-2.5-flash";

function errorResponse(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

/** Only include Set-Cookie when there's actually a new cookie to set. */
function cookieHeaders(setCookie: string): HeadersInit {
  return setCookie ? { "Set-Cookie": setCookie } : {};
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return errorResponse(
      "Server is missing GEMINI_API_KEY. Set it in .env.local.",
      500
    );
  }

  const rateLimit = checkRateLimit(req);
  if (!rateLimit.allowed) {
    await logGuardrailEvent({
      timestamp: new Date().toISOString(),
      sessionId: rateLimit.sessionId,
      persona: null,
      messageLength: 0,
      messagePreview: "",
      dangerVerdict: null,
      outcome: "rate-limited",
    });
    return errorResponse(rateLimit.message, 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
      ...cookieHeaders(rateLimit.setCookie),
    });
  }

  const { sessionId } = rateLimit;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    await logGuardrailEvent({
      timestamp: new Date().toISOString(),
      sessionId,
      persona: null,
      messageLength: 0,
      messagePreview: "",
      dangerVerdict: null,
      outcome: "error",
    });
    return errorResponse("Request body must be valid JSON.", 400, cookieHeaders(rateLimit.setCookie));
  }

  const validation = validateChatRequest(rawBody);
  if (!validation.success) {
    await logGuardrailEvent({
      timestamp: new Date().toISOString(),
      sessionId,
      persona: null,
      messageLength: 0,
      messagePreview: "",
      dangerVerdict: null,
      outcome: "error",
    });
    return errorResponse(validation.error, 400, cookieHeaders(rateLimit.setCookie));
  }

  const { persona, messages, runningMemory: previousRunningMemory } = validation.data;

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") {
    await logGuardrailEvent({
      timestamp: new Date().toISOString(),
      sessionId,
      persona,
      messageLength: lastMessage.content.length,
      messagePreview: truncateForLog(lastMessage.content),
      dangerVerdict: null,
      outcome: "error",
    });
    return errorResponse(
      "The last message must be a non-empty user message.",
      400,
      cookieHeaders(rateLimit.setCookie)
    );
  }

  const logBase = {
    sessionId,
    persona,
    messageLength: lastMessage.content.length,
    messagePreview: truncateForLog(lastMessage.content),
  };

  const safety = await checkInputSafety(lastMessage.content);
  if (safety.blocked) {
    await logGuardrailEvent({
      timestamp: new Date().toISOString(),
      ...logBase,
      dangerVerdict: safety.verdict,
      outcome: "blocked",
    });
    return errorResponse(
      "This message can't be processed. Please rephrase and try again.",
      403,
      cookieHeaders(rateLimit.setCookie)
    );
  }

  try {
    const [retrievedExcerpts, context] = await Promise.all([
      retrieveExcerpts(persona, lastMessage.content),
      manageContext(messages, previousRunningMemory),
    ]);

    const systemPrompt = buildSystemPrompt(
      persona,
      retrievedExcerpts,
      context.runningMemory
    );

    // withFallback returns the live fullStream reader plus the first part it
    // already pulled off that reader (to detect a 429/quota error on this key
    // before any bytes reach the client), so the text stream below can replay
    // that first part instead of losing it.
    const { reader, firstPart } = await withFallback(async (key) => {
      const google = createGoogleGenerativeAI({ apiKey: key.value });
      const streamResult = streamText({
        model: google(CHAT_MODEL),
        system: systemPrompt,
        messages: context.verbatimMessages,
      });
      const streamReader = streamResult.fullStream.getReader();
      // Skip past lifecycle parts (e.g. "start") that precede the first
      // real content or error — Gemini's stream always emits "start" first,
      // so peeking only the very first part would miss a 429/quota error
      // that only surfaces once the underlying request actually resolves.
      let part: Awaited<ReturnType<typeof streamReader.read>>["value"];
      do {
        ({ value: part } = await streamReader.read());
        if (part?.type === "error") {
          throw part.error;
        }
      } while (part?.type === "start");
      return { reader: streamReader, firstPart: part };
    });

    const encoder = new TextEncoder();
    const textStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        function enqueuePart(part: { type: string; text?: string } | undefined) {
          if (part?.type === "text-delta" && typeof part.text === "string") {
            controller.enqueue(encoder.encode(part.text));
          }
        }
        try {
          enqueuePart(firstPart);
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            enqueuePart(value);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    await logGuardrailEvent({
      timestamp: new Date().toISOString(),
      ...logBase,
      dangerVerdict: safety.verdict,
      outcome: "allowed",
    });

    return new Response(textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Persona-Id": persona,
        "X-Running-Memory": context.runningMemory
          ? encodeURIComponent(context.runningMemory)
          : "",
        ...cookieHeaders(rateLimit.setCookie),
      },
    });
  } catch (err) {
    const outcome: GuardrailOutcome = "error";
    await logGuardrailEvent({
      timestamp: new Date().toISOString(),
      ...logBase,
      dangerVerdict: safety.verdict,
      outcome,
    });
    if (err instanceof AllKeysExhaustedError) {
      return errorResponse(
        "I'm a bit overloaded right now, please try again in a minute.",
        503,
        cookieHeaders(rateLimit.setCookie)
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Chat request failed: ${message}`, 500, cookieHeaders(rateLimit.setCookie));
  }
}
