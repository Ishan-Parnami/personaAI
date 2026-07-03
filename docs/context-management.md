# Context Management

Persona AI is stateless on the server between requests — there's no database or session store for chat history. The client resends the full message history on every request, and the server manages what gets sent to the model and what gets summarized, via `lib/contextManager.ts`.

## Sliding window + running summary

`manageContext(messages, previousRunningMemory?)` in `lib/contextManager.ts`:

- If the conversation has **6 or fewer messages** (`VERBATIM_TURN_COUNT = 6`, roughly the last 3 user+assistant exchanges), every message is sent to the model verbatim, and any `previousRunningMemory` passed in is carried through unchanged.
- If the conversation is **longer than 6 messages**, it's split into:
  - `verbatimMessages` — the last 6 messages, sent to the model in full, unmodified.
  - Everything older is summarized by calling `generateText()` (Gemini, `gemini-2.5-flash`) with a prompt asking for a short, factual running-memory note — explicitly instructed to preserve names/facts/preferences and to **merge** with any existing `previousRunningMemory` rather than just appending to it, so the summary doesn't grow unbounded across many turns.

This keeps the tail of the conversation exact (so recent back-and-forth reads naturally) while compressing everything before that into a short note, instead of either (a) resending an ever-growing full transcript on every call, or (b) truncating older context and losing it entirely.

## Why this approach over the alternatives

- **Resending the full transcript forever** is the simplest option but has unbounded token cost as a conversation grows, and most of that history is irrelevant to the current turn.
- **Hard truncation** (just drop anything older than N messages) is cheap but loses real information — a fact mentioned 10 turns ago silently disappears.
- **LLM summarization of the older tail** costs one extra `generateText()` call per request once a conversation exceeds the verbatim window, but keeps the token cost of long conversations roughly flat while retaining the gist of earlier context. Given this app has no persistence layer, that tradeoff was judged worth it — an extra Gemini call is cheap relative to losing conversation continuity entirely.

## How continuity survives across stateless requests

Since there's no server-side session store, the running-memory summary itself has to travel with the client:

- The server returns it in the `X-Running-Memory` response header (URL-encoded), from `app/api/chat/route.ts`.
- The client is expected to pass it back as `runningMemory` in the next request body.
- `manageContext` merges it with any newly-summarized older turns on the next call.

This means conversation continuity beyond the verbatim window depends entirely on the client faithfully round-tripping that header — there's no server-side fallback if it's dropped.

## Why the full system prompt is resent every turn

`buildSystemPrompt()` (see [`docs/prompt-engineering.md`](./prompt-engineering.md)) is rebuilt and passed as the `system` message on **every** call to `streamText()`, not just turn 1. Combined with the running-memory section being appended when present, this is what keeps persona voice, tone rules, and hard rules from drifting as a conversation gets longer — the model is re-grounded in the full persona spec on every single request rather than relying on the model to "remember" character instructions from earlier in a long context window.

## Resilience: key fallback and rate limiting

Two additional systems sit around the core context/prompt pipeline in `app/api/chat/route.ts`, both there to protect against the free-tier Gemini API's own rate limits rather than being part of context management itself:

**Multi-key fallback** (`lib/gemini/keyManager.ts`, `lib/gemini/withFallback.ts`) — the app can be configured with up to three Gemini API keys (`GEMINI_API_KEY` primary, plus optional `GEMINI_API_KEY_FALLBACK_1`/`_2`). `withFallback()` tries each usable key in order; on a retryable error (HTTP 429 or 503, or `RetryError.isInstance()` wrapping one of those), it marks that key exhausted for a cooldown period (`KEY_COOLDOWN_SECONDS`, default 300s/5min) and rotates to the next key. Non-retryable errors propagate immediately without rotating. If all keys are exhausted, `AllKeysExhaustedError` is thrown and surfaced to the client as an HTTP 503.

**Our own rate limiting** (`lib/rateLimiter.ts`) — separate from Gemini's own limits, this guards the app's own free-tier quota from being exhausted by a single abusive client. It's an in-memory sliding-window limiter keyed by `${ip}:${sessionId}` (session identified via an `httpOnly` `persona_session_id` cookie set on first request). Current actual defaults, read from `rateLimiter.ts`:

- **5 requests per minute** (`RATE_LIMIT_PER_MINUTE` env var to override)
  - **50 requests per day** (`RATE_LIMIT_PER_DAY` env var to override)

  > **Known inconsistency to flag:** `.env.example`'s comment for `RATE_LIMIT_PER_DAY` currently says "default 50 if unset," but the actual code default in `rateLimiter.ts` (`DEFAULT_MAX_PER_DAY`) is 50. The numbers above reflect the real code behavior; the `.env.example` comment appears to be stale and should be corrected separately (not fixed here, since this pass is documentation-only).

  This store is explicitly **not distributed-safe** — it's a plain in-memory `Map` per server instance, resets on restart/cold start, and would need to move to something like Redis (`INCR`+`EXPIRE` or a sorted set) for a multi-instance production deployment. That tradeoff is called out directly in a comment in `rateLimiter.ts` and is intentional for this project's scope.
