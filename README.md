# Persona AI

Chat with AI personas of [Hitesh Choudhary](https://www.youtube.com/@chaiaurcode) and [Piyush Garg](https://www.piyushgarg.dev/), built from real, sourced research into how each of them actually talks and teaches — not a generic "act like X" prompt.

**Live deployment:** _not yet deployed — placeholder, see "Deployment" below._

## What this is

- Two personas, each defined by a research-backed spec (`lib/personas/{hitesh,piyush}.json`) covering identity, tone rules, teaching approach, vocabulary quirks, and hard rules — see [`docs/persona-research.md`](./docs/persona-research.md) for sourcing and confidence levels.
- A lightweight RAG pipeline: each persona has ~26–27 real, sourced excerpts (tweets, blog posts, course descriptions) embedded with Gemini and retrieved by cosine similarity per user message, injected into the system prompt as style reference only. See [`docs/prompt-engineering.md`](./docs/prompt-engineering.md).
- Stateless context management: last 6 messages sent verbatim, anything older LLM-summarized into a running-memory note round-tripped via a response header. See [`docs/context-management.md`](./docs/context-management.md).
- Resilience: multi-key Gemini fallback (primary + up to 2 fallback keys, auto-rotated on 429/503) and an in-memory rate limiter guarding the app's own free-tier quota. Also covered in [`docs/context-management.md`](./docs/context-management.md).
- [`docs/sample-conversations.md`](./docs/sample-conversations.md) has real, unedited multi-turn transcripts from the live API showing persona consistency.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`, `@ai-sdk/google`) with Gemini (`gemini-2.5-flash` for chat, `gemini-embedding-001` for retrieval)
- Tailwind CSS
- pnpm

## Setup

1. Clone and install:

   ```bash
   pnpm install
   ```

2. Copy the env template and fill in your Gemini API key(s):

   ```bash
   cp .env.example .env.development
   ```

   Only `GEMINI_API_KEY` is required. See `.env.example` for the optional fallback keys, cooldown, retrieval, and rate-limit env vars and their defaults.

3. Generate persona excerpt embeddings (required before retrieval will work):

   ```bash
   pnpm embed-excerpts
   ```

4. Run the dev server:

   ```bash
   pnpm dev
   ```

   App runs at `http://localhost:3000`.

## Project structure

```text
app/
  api/chat/route.ts      # chat endpoint: rate limit → retrieval + context → prompt → stream
  chat/page.tsx           # chat UI
lib/
  personas/               # persona specs, excerpts, generated embeddings, research notes.md
  retrieval.ts             # excerpt embedding + cosine-similarity top-K retrieval
  promptBuilder.ts          # assembles the system prompt from persona spec + excerpts
  contextManager.ts          # verbatim window + LLM summarization of older turns
  rateLimiter.ts               # in-memory sliding-window rate limiter
  gemini/
    keyManager.ts               # tracks usable/exhausted Gemini API keys
    withFallback.ts              # retries a call across keys on 429/503
scripts/
  embedExcerpts.ts          # precomputes excerpt embeddings, run via pnpm embed-excerpts
docs/                        # persona-research, prompt-engineering, context-management, sample-conversations
```

## Deployment

Not yet deployed. This README will be updated with a live URL once deployment happens — deployment was explicitly out of scope for this pass.
