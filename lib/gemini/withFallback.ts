import { APICallError } from "ai";
import { getUsableKeys, markKeyExhausted, type GeminiKey } from "./keyManager";

export class AllKeysExhaustedError extends Error {
  constructor() {
    super("All Gemini API keys are currently exhausted or rate-limited.");
    this.name = "AllKeysExhaustedError";
  }
}

function isRetryableError(err: unknown): boolean {
  if (APICallError.isInstance(err)) {
    if (err.statusCode === 429) return true;
    if (err.isRetryable) return true;
    // Google sometimes returns 503 for transient overload — treat as retryable too.
    if (err.statusCode === 503) return true;
    return false;
  }
  return false;
}

/**
 * Calls `fn` with each usable key in order (primary -> fallback_1 -> fallback_2),
 * rotating to the next key only on retryable quota/rate-limit errors (429/503).
 * Non-retryable errors (bad request, invalid persona, etc.) propagate immediately
 * without rotating keys.
 */
export async function withFallback<T>(
  fn: (key: GeminiKey) => Promise<T>
): Promise<T> {
  const usableKeys = getUsableKeys();

  if (usableKeys.length === 0) {
    throw new AllKeysExhaustedError();
  }

  let lastError: unknown;

  for (const key of usableKeys) {
    try {
      console.log(`[withFallback] Attempting call with key "${key.label}" (index ${key.index}).`);
      return await fn(key);
    } catch (err) {
      if (!isRetryableError(err)) {
        console.warn(
          `[withFallback] Non-retryable error with key "${key.label}" — propagating immediately.`
        );
        throw err;
      }
      console.warn(
        `[withFallback] Key "${key.label}" (index ${key.index}) hit a retryable error — rotating.`
      );
      markKeyExhausted(key.index);
      lastError = err;
    }
  }

  console.error("[withFallback] All usable keys exhausted during this call.");
  throw new AllKeysExhaustedError();
  // (lastError is intentionally not re-thrown — AllKeysExhaustedError is the clean,
  // typed error route.ts is expected to catch; raw provider errors stay server-side.)
  void lastError;
}
