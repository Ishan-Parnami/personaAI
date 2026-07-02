/**
 * One-time script: embeds every excerpt for each persona using Gemini's
 * embedding model and writes the vectors to lib/personas/<id>.embeddings.json.
 *
 * Run with: pnpm embed-excerpts
 * Re-run whenever an excerpts JSON file changes.
 */
import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(__dirname, "..", ".env.local") });

import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { readFileSync, writeFileSync } from "node:fs";

const EMBEDDING_MODEL = "gemini-embedding-001";
const PERSONAS_DIR = path.join(__dirname, "..", "lib", "personas");
const PERSONA_IDS = ["hitesh", "piyush"] as const;

type Excerpt = {
  id: string;
  text: string;
  source: string;
  sourceType: string;
  topic: string;
  date: string;
};

async function embedPersona(id: string) {
  const excerptsPath = path.join(PERSONAS_DIR, `${id}.excerpts.json`);
  const { excerpts } = JSON.parse(readFileSync(excerptsPath, "utf-8")) as {
    excerpts: Excerpt[];
  };

  console.log(`Embedding ${excerpts.length} excerpts for "${id}"...`);

  const { embeddings } = await embedMany({
    model: google.embedding(EMBEDDING_MODEL),
    values: excerpts.map((e) => e.text),
  });

  const output = {
    model: EMBEDDING_MODEL,
    generatedAt: new Date().toISOString(),
    excerpts: excerpts.map((excerpt, i) => ({
      id: excerpt.id,
      embedding: embeddings[i],
    })),
  };

  const outPath = path.join(PERSONAS_DIR, `${id}.embeddings.json`);
  writeFileSync(outPath, JSON.stringify(output));
  console.log(`Wrote ${outPath}`);
}

async function main() {
  for (const id of PERSONA_IDS) {
    await embedPersona(id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
