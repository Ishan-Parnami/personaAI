import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "guardrail.jsonl");
const PREVIEW_LENGTH = 200;

export type DangerVerdict = "yes" | "no" | "ambiguous" | null;
export type GuardrailOutcome = "allowed" | "blocked" | "rate-limited" | "error";

export type GuardrailLogEntry = {
  timestamp: string;
  sessionId: string;
  persona: string | null;
  messageLength: number;
  messagePreview: string;
  dangerVerdict: DangerVerdict;
  outcome: GuardrailOutcome;
};

/** Builds a truncated preview of a message for logging (never the full content). */
export function truncateForLog(content: string): string {
  return content.length > PREVIEW_LENGTH ? `${content.slice(0, PREVIEW_LENGTH)}…` : content;
}

/**
 * Appends one JSON line per request to logs/guardrail.jsonl. Never throws —
 * a logging failure must not break the request it's logging.
 */
export async function logGuardrailEvent(entry: GuardrailLogEntry): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (err) {
    console.error("[guardrails/logger] Failed to write log entry:", err);
  }
}
