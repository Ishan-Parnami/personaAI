# Persona Research

This documents how the two personas — Hitesh Choudhary and Piyush Garg — were researched, sourced, and encoded into `lib/personas/hitesh.json` and `lib/personas/piyush.json`. The full, unabridged research log (sources, confidence tiers, gaps) lives in `lib/personas/notes.md`; this doc summarizes it faithfully rather than replacing it.

## Methodology

For each persona, research pulled from multiple public source types:

- **X/Twitter** — individual tweets, sourced via search-engine result snippets rather than direct page fetch (`x.com` returned HTTP 402 in the research environment). Each tweet excerpt retains its original URL for traceability.
- **Official sites / blogs** — Piyush's [piyushgarg.dev](https://www.piyushgarg.dev/) and [blog.piyushgarg.dev](https://blog.piyushgarg.dev/); Hitesh's GitHub course READMEs.
- **Course platforms** — Udemy instructor profile, [learn.piyushgarg.dev](https://learn.piyushgarg.dev/).
- **GitHub** — README text (Hitesh's own Hinglish course descriptions) and one third-party student-notes repo transcribing Piyush's Node.js bootcamp.
- **One transcript site** — a TEDx-style talk transcript for Hitesh (spoken-voice evidence).
- **One interview video** (Piyush) — cited as a known source but yielded no usable transcript in this pass; not used as a quote source.

Every trait or phrase that made it into the persona JSON files is backed by at least one source in `notes.md`. Where a plausible trait could **not** be verified, it was explicitly left out rather than invented — see "Known gaps" below.

## Confidence tiers

Research notes classify every claim into one of three tiers:

- **Strongly evidenced** — appears independently across multiple sources/source types.
- **Moderately evidenced** — appears in only one or two sources, plausible but thinner.
- **Removed / flagged** — appeared in an early draft or seemed plausible, but no sourced instance was found; explicitly excluded rather than asserted as fact.

### Hitesh Choudhary — strongly evidenced

- "Hanji" as an opening/affirmation tic — the single most reliable trait, found across tweets (2024–2025) and his GitHub README.
- Hinglish code-switching in both speech and writing.
- Direct/sarcastic pushback on hype-chasing and shortcut culture (DSA obsession, one-API-call "AI projects," college trend-pressure).
- "Consistency over intensity" as a core teaching/mindset message (TEDx transcript + tweets).
- Practical, build-first framing tied to real ex-CTO/founder hiring experience.

### Hitesh Choudhary — removed/flagged (explicitly excluded, not invented)

- "Haan ji" (long form) — only the contracted "Hanji" was actually sourced.
- "Samajh aaya?", "production mein", "logic clear honi chahiye" — no sourced instance found; left out of `vocabularyQuirks`.
- A specific self-deprecating "my own past mistakes" anecdote pattern — plausible given his background, but no repeated, verified instance found.
- Any closing/sign-off catchphrase — none found. Flagged as a gap, not filled with a guess.

### Piyush Garg — strongly evidenced

- Project-based, build-first teaching anchored in real end-to-end projects (Twitter clone, video chat, Docker course).
- "Why before how" structure — relatable scenario → stated problem/consequence → code — observed directly in his own blog writing and echoed by third-party descriptions of his teaching style.
- Explicit trade-off/production framing (e.g. performance cost of blocking the main thread) — observed directly in his blog posts.
- Provocative "X is Dead" video-title pattern, deliberately walked back into substantive, non-nihilistic content — repeated pattern, confirmed via third-party commentary.
- Founder/practitioner identity (Teachyst founder; prior SDE at Juspay, Emitrr, Dimension, Oraczen) — consistent across his own site, Udemy bio, GitHub.

### Piyush Garg — removed/flagged (explicitly excluded, not invented)

- "scale hoga toh", "yeh dekhlo", "trade-off hai", "docs check karlo" — none of these exact Hinglish phrases could be sourced; the underlying *concept* (trade-off discussion) is well evidenced, the specific wording wasn't, so it was left out.
- A single fixed catchphrase equivalent to Hitesh's "Hanji" — no equivalent found; his distinctiveness is structural (why-before-how, provocative titling), not lexical. Flagged as a gap rather than invented.
- A "WisprType built in 24 hours" story — excluded entirely. Sources suggest this may belong to a *different* person also named Piyush Garg (an indie macOS developer); given the name collision and conflicting attribution, it was dropped rather than risk misattributing it.

## Known gaps (honestly stated)

- Neither persona's native YouTube video transcripts were directly accessible in the research environment. Spoken-voice evidence for Hitesh comes from one third-party TEDx-style transcript, not his own Chai aur Code videos. For Piyush, technical-teaching-voice evidence leans on his written blog and one third-party student-notes repo rather than his own video transcripts.
- Neither persona has a verified sign-off/closing catchphrase.
- Follower/subscriber counts and specific employment dates are self-reported (from bios), not independently fact-checked — kept general in `identity.background` rather than cited as precise figures.
- `x.com` pages were not directly fetchable (HTTP 402); all tweet excerpts were sourced via search-engine snippets, with original tweet URLs preserved per excerpt so they can be spot-checked manually.

Full source list, per-item confidence, and the complete gap list are in [`lib/personas/notes.md`](../lib/personas/notes.md).

## How research became retrieval data

Each persona has two files under `lib/personas/`:

- **`{persona}.json`** — the structured spec (`identity`, `toneRules`, `teachingApproach`, `vocabularyQuirks`, `doNots`, `sampleOpeners`) consumed directly by `promptBuilder.ts` to assemble the system prompt on every request.
- **`{persona}.excerpts.json`** — 27 (Hitesh) / 26 (Piyush) real, sourced excerpts (tweets, blog snippets, course descriptions), each tagged with `topic`, `sourceType`, `source` URL, and `date`.

At startup, `scripts/embedExcerpts.ts` embeds every excerpt with Gemini's `gemini-embedding-001` model and writes the vectors to `{persona}.embeddings.json`. At request time, `lib/retrieval.ts` embeds the user's current message, computes cosine similarity against the persona's precomputed excerpt embeddings, and returns the top-K (default 3, configurable via `RETRIEVAL_TOP_K`) most relevant excerpts. This is a lightweight RAG pipeline — there's no vector database; similarity is a plain in-memory dot-product scan over a few dozen vectors, which is fast enough given each persona has under 30 excerpts.

These retrieved excerpts are injected into the system prompt as **style/tone reference only** — the model is explicitly instructed not to quote them verbatim or treat them as answers. See [`docs/prompt-engineering.md`](./prompt-engineering.md) for how that instruction is worded and why.
