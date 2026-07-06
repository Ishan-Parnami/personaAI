import { randomUUID } from "node:crypto";

const DEFAULT_MAX_PER_MINUTE = 5;
const DEFAULT_MAX_PER_DAY = 50;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "persona_session_id";

function getMaxPerMinute(): number {
  const raw = process.env.RATE_LIMIT_PER_MINUTE;
  if (!raw) return DEFAULT_MAX_PER_MINUTE;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[rateLimiter] Invalid RATE_LIMIT_PER_MINUTE="${raw}" — falling back to default ${DEFAULT_MAX_PER_MINUTE}.`
    );
    return DEFAULT_MAX_PER_MINUTE;
  }
  return parsed;
}

function getMaxPerDay(): number {
  const raw = process.env.RATE_LIMIT_PER_DAY;
  if (!raw) return DEFAULT_MAX_PER_DAY;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[rateLimiter] Invalid RATE_LIMIT_PER_DAY="${raw}" — falling back to default ${DEFAULT_MAX_PER_DAY}.`
    );
    return DEFAULT_MAX_PER_DAY;
  }
  return parsed;
}

// In-memory sliding-window store: Map<`${ip}:${sessionId}`, timestamps of requests>.
// Each entry is an array of request timestamps (ms); on each check we drop
// timestamps older than the day window and count how many fall within the
// minute/day windows. This resets on server restart/cold start and is NOT
// distributed-safe (each server instance has its own map) — a production
// upgrade would move this to Redis (e.g. INCR + EXPIRE or a sorted set).
const requestLog = new Map<string, number[]>();

export type RateLimitResult =
  | { allowed: true; setCookie: string; sessionId: string }
  | {
      allowed: false;
      message: string;
      retryAfterSeconds: number;
      setCookie: string;
      sessionId: string;
    };

function getSessionId(req: Request): { sessionId: string; setCookie: string } {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)persona_session_id=([^;]+)/);
  if (match) {
    return { sessionId: match[1], setCookie: "" };
  }
  const sessionId = randomUUID();
  const setCookie = `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`;
  return { sessionId, setCookie };
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(req: Request): RateLimitResult {
  const ip = getClientIp(req);
  const { sessionId, setCookie } = getSessionId(req);
  const key = `${ip}:${sessionId}`;
  const now = Date.now();

  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < DAY_MS);

  const requestsInLastMinute = timestamps.filter((t) => now - t < MINUTE_MS);
  if (requestsInLastMinute.length >= getMaxPerMinute()) {
    const oldestInWindow = Math.min(...requestsInLastMinute);
    const retryAfterSeconds = Math.ceil((MINUTE_MS - (now - oldestInWindow)) / 1000);
    return {
      allowed: false,
      message: "You're sending messages too quickly. Please slow down and try again shortly.",
      retryAfterSeconds,
      setCookie,
      sessionId,
    };
  }

  if (timestamps.length >= getMaxPerDay()) {
    const oldestInWindow = Math.min(...timestamps);
    const retryAfterSeconds = Math.ceil((DAY_MS - (now - oldestInWindow)) / 1000);
    return {
      allowed: false,
      message: "You've reached today's message limit. Please try again tomorrow.",
      retryAfterSeconds,
      setCookie,
      sessionId,
    };
  }

  timestamps.push(now);
  requestLog.set(key, timestamps);

  return { allowed: true, setCookie, sessionId };
}
