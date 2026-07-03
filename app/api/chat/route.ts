import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { retrieveExcerpts } from "@/lib/retrieval";
import { buildSystemPrompt } from "@/lib/promptBuilder";
import { manageContext, type ChatMessage } from "@/lib/contextManager";
import { withFallback, AllKeysExhaustedError } from "@/lib/gemini/withFallback";
import { checkRateLimit } from "@/lib/rateLimiter";

const CHAT_MODEL = "gemini-2.5-flash";
const VALID_PERSONAS = ["hitesh", "piyush"] as const;
type PersonaId = (typeof VALID_PERSONAS)[number];

type ChatRequestBody = {
  persona?: string;
  messages?: ChatMessage[];
  /** Running memory summary carried over from a previous response, if any. */
  runningMemory?: string;
};

function isValidPersona(value: unknown): value is PersonaId {
  return typeof value === "string" && (VALID_PERSONAS as readonly string[]).includes(value);
}

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
    return errorResponse(rateLimit.message, 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
      ...cookieHeaders(rateLimit.setCookie),
    });
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return errorResponse("Request body must be valid JSON.", 400, cookieHeaders(rateLimit.setCookie));
  }

  const { persona, messages, runningMemory: previousRunningMemory } = body;

  if (!isValidPersona(persona)) {
    return errorResponse(
      `Invalid or missing "persona". Must be one of: ${VALID_PERSONAS.join(", ")}.`,
      400,
      cookieHeaders(rateLimit.setCookie)
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse('"messages" must be a non-empty array.', 400, cookieHeaders(rateLimit.setCookie));
  }

  const lastMessage = messages[messages.length - 1];
  if (
    !lastMessage ||
    lastMessage.role !== "user" ||
    typeof lastMessage.content !== "string" ||
    lastMessage.content.trim().length === 0
  ) {
    return errorResponse(
      "The last message must be a non-empty user message.",
      400,
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
