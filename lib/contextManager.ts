import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { withFallback } from "@/lib/gemini/withFallback";

const CHAT_MODEL = "gemini-2.5-flash";
const VERBATIM_TURN_COUNT = 6; // last N messages (≈3 user+assistant exchanges) kept in full

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ManagedContext = {
  /** Most recent messages, kept verbatim, in chronological order. */
  verbatimMessages: ChatMessage[];
  /** Short running summary of anything older than the verbatim window, if any. */
  runningMemory?: string;
};

/**
 * Splits the full message history into a verbatim tail (last
 * VERBATIM_TURN_COUNT messages) and, if there's anything older, summarizes
 * it via the LLM into a short running memory note. The persona's full
 * system prompt is rebuilt and resent on every call by the caller
 * (promptBuilder + route), not just on turn 1.
 */
export async function manageContext(
  messages: ChatMessage[],
  previousRunningMemory?: string
): Promise<ManagedContext> {
  if (messages.length <= VERBATIM_TURN_COUNT) {
    return {
      verbatimMessages: messages,
      runningMemory: previousRunningMemory,
    };
  }

  const cutoff = messages.length - VERBATIM_TURN_COUNT;
  const olderMessages = messages.slice(0, cutoff);
  const verbatimMessages = messages.slice(cutoff);

  const runningMemory = await summarizeOlderTurns(
    olderMessages,
    previousRunningMemory
  );

  return { verbatimMessages, runningMemory };
}

async function summarizeOlderTurns(
  olderMessages: ChatMessage[],
  previousRunningMemory?: string
): Promise<string> {
  const transcript = olderMessages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const priorSummaryBlock = previousRunningMemory
    ? `Existing running summary so far:\n${previousRunningMemory}\n\n`
    : "";

  const prompt =
    `${priorSummaryBlock}Summarize the following older conversation turns into a short running memory note (a few sentences, factual, no commentary). ` +
    `Preserve any facts, names, or preferences the user mentioned that would matter for later replies. ` +
    `Merge it with the existing summary above if one was provided, rather than just appending.\n\n` +
    `Conversation to summarize:\n${transcript}`;

  return withFallback(async (key) => {
    const google = createGoogleGenerativeAI({ apiKey: key.value });
    const { text } = await generateText({
      model: google(CHAT_MODEL),
      prompt,
    });
    return text.trim();
  });
}
