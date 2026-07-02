import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { readFileSync } from "node:fs";
import path from "node:path";
import { withFallback } from "./gemini/withFallback";

const EMBEDDING_MODEL = "gemini-embedding-001";
const PERSONAS_DIR = path.join(process.cwd(), "lib", "personas");
const DEFAULT_TOP_K = 3;

export type Excerpt = {
  id: string;
  text: string;
  source: string;
  sourceType: string;
  topic: string;
  date: string;
};

type EmbeddingsFile = {
  model: string;
  generatedAt: string;
  excerpts: { id: string; embedding: number[] }[];
};

type RetrievedExcerpt = Excerpt & { score: number };

function getTopK(): number {
  const raw = process.env.RETRIEVAL_TOP_K;
  if (!raw) return DEFAULT_TOP_K;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOP_K;
}

function loadExcerpts(personaId: string): Excerpt[] {
  const filePath = path.join(PERSONAS_DIR, `${personaId}.excerpts.json`);
  const { excerpts } = JSON.parse(readFileSync(filePath, "utf-8")) as {
    excerpts: Excerpt[];
  };
  return excerpts;
}

function loadEmbeddings(personaId: string): EmbeddingsFile {
  const filePath = path.join(PERSONAS_DIR, `${personaId}.embeddings.json`);
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(
      `Missing embeddings file for persona "${personaId}" at ${filePath}. ` +
        `Run "pnpm embed-excerpts" to generate it before using retrieval.`
    );
  }
  return JSON.parse(raw) as EmbeddingsFile;
}

export async function embedQuery(query: string): Promise<number[]> {
  return withFallback(async (key) => {
    const google = createGoogleGenerativeAI({ apiKey: key.value });
    const { embedding } = await embed({
      model: google.embedding(EMBEDDING_MODEL),
      value: query,
    });
    return embedding;
  });
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Cannot compute cosine similarity: vector lengths differ (${a.length} vs ${b.length})`
    );
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function retrieveExcerpts(
  personaId: string,
  query: string,
  topK: number = getTopK()
): Promise<RetrievedExcerpt[]> {
  const excerpts = loadExcerpts(personaId);
  const embeddingsFile = loadEmbeddings(personaId);

  const embeddingById = new Map(
    embeddingsFile.excerpts.map((e) => [e.id, e.embedding])
  );

  const queryEmbedding = await embedQuery(query);

  const scored: RetrievedExcerpt[] = excerpts
    .filter((excerpt) => embeddingById.has(excerpt.id))
    .map((excerpt) => ({
      ...excerpt,
      score: cosineSimilarity(queryEmbedding, embeddingById.get(excerpt.id)!),
    }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}
