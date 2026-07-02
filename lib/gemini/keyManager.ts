const DEFAULT_COOLDOWN_SECONDS = 300; // 5 minutes

export type GeminiKey = {
  index: number;
  label: string;
  value: string;
};

type ExhaustedEntry = {
  exhaustedAt: number;
};

function getCooldownMs(): number {
  const raw = process.env.KEY_COOLDOWN_SECONDS;
  if (!raw) return DEFAULT_COOLDOWN_SECONDS * 1000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed * 1000
    : DEFAULT_COOLDOWN_SECONDS * 1000;
}

function loadKeys(): GeminiKey[] {
  const keys: GeminiKey[] = [];

  const primary = process.env.GEMINI_API_KEY;
  if (!primary || primary.trim().length === 0) {
    throw new Error(
      "Missing required GEMINI_API_KEY. Set it in your environment before starting the server."
    );
  }
  keys.push({ index: 0, label: "primary", value: primary });

  const fallback1 = process.env.GEMINI_API_KEY_FALLBACK_1;
  if (fallback1 && fallback1.trim().length > 0) {
    keys.push({ index: 1, label: "fallback_1", value: fallback1 });
  } else {
    console.warn("[keyManager] GEMINI_API_KEY_FALLBACK_1 not set — skipping.");
  }

  const fallback2 = process.env.GEMINI_API_KEY_FALLBACK_2;
  if (fallback2 && fallback2.trim().length > 0) {
    keys.push({ index: 2, label: "fallback_2", value: fallback2 });
  } else {
    console.warn("[keyManager] GEMINI_API_KEY_FALLBACK_2 not set — skipping.");
  }

  return keys;
}

let cachedKeys: GeminiKey[] | null = null;
const exhausted = new Map<number, ExhaustedEntry>();

function getKeys(): GeminiKey[] {
  if (!cachedKeys) {
    cachedKeys = loadKeys();
  }
  return cachedKeys;
}

function isExhausted(index: number): boolean {
  const entry = exhausted.get(index);
  if (!entry) return false;
  const stillCooling = Date.now() - entry.exhaustedAt < getCooldownMs();
  if (!stillCooling) {
    exhausted.delete(index);
    return false;
  }
  return true;
}

/** Returns usable keys in order (primary, fallback_1, fallback_2), skipping currently-exhausted ones. */
export function getUsableKeys(): GeminiKey[] {
  return getKeys().filter((key) => !isExhausted(key.index));
}

export function markKeyExhausted(index: number): void {
  exhausted.set(index, { exhaustedAt: Date.now() });
  console.warn(`[keyManager] Key index ${index} marked exhausted, cooling down.`);
}

export function getAllKeys(): GeminiKey[] {
  return getKeys();
}
