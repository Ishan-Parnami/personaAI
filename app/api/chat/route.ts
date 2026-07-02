import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { retrieveExcerpts } from "@/lib/retrieval";
import { buildSystemPrompt } from "@/lib/promptBuilder";
import { manageContext, type ChatMessage } from "@/lib/contextManager";

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

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return errorResponse(
      "Server is missing GOOGLE_GENERATIVE_AI_API_KEY. Set it in .env.local.",
      500
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const { persona, messages, runningMemory: previousRunningMemory } = body;

  if (!isValidPersona(persona)) {
    return errorResponse(
      `Invalid or missing "persona". Must be one of: ${VALID_PERSONAS.join(", ")}.`,
      400
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse('"messages" must be a non-empty array.', 400);
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
      400
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

    const result = streamText({
      model: google(CHAT_MODEL),
      system: systemPrompt,
      messages: context.verbatimMessages,
    });

    return result.toTextStreamResponse({
      headers: {
        "X-Persona-Id": persona,
        "X-Running-Memory": context.runningMemory
          ? encodeURIComponent(context.runningMemory)
          : "",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Chat request failed: ${message}`, 500);
  }
}
