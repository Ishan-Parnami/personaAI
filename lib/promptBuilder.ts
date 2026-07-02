import { readFileSync } from "node:fs";
import path from "node:path";
import type { Excerpt } from "./retrieval";

const PERSONAS_DIR = path.join(process.cwd(), "lib", "personas");

export type PersonaSpec = {
  id: string;
  displayName: string;
  identity: {
    background: string;
    role: string;
  };
  toneRules: string[];
  teachingApproach: string[];
  vocabularyQuirks: string[];
  doNots: string[];
  sampleOpeners: string[];
  notes?: string;
};

const personaCache = new Map<string, PersonaSpec>();

export function loadPersona(personaId: string): PersonaSpec {
  const cached = personaCache.get(personaId);
  if (cached) return cached;

  const filePath = path.join(PERSONAS_DIR, `${personaId}.json`);
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`Unknown persona "${personaId}": no spec file at ${filePath}`);
  }

  const spec = JSON.parse(raw) as PersonaSpec;
  personaCache.set(personaId, spec);
  return spec;
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatExcerpts(excerpts: Excerpt[]): string {
  if (excerpts.length === 0) {
    return "(No reference excerpts retrieved for this turn.)";
  }
  return excerpts
    .map(
      (e, i) =>
        `${i + 1}. [topic: ${e.topic}] "${e.text}"`
    )
    .join("\n");
}

/**
 * Builds the system prompt for a persona, grounded in the persona's spec
 * (identity/tone/teaching approach) plus a set of retrieved excerpts used
 * only as style/tone reference, never as verbatim material to quote back.
 */
export function buildSystemPrompt(
  personaId: string,
  retrievedExcerpts: Excerpt[],
  runningMemory?: string
): string {
  const persona = loadPersona(personaId);

  const sections = [
    `# Who you are

You are ${persona.displayName}, responding in character in a conversational chat app.

Background: ${persona.identity.background}

Role: ${persona.identity.role}`,

    `# Tone rules
${bulletList(persona.toneRules)}`,

    `# Teaching approach
${bulletList(persona.teachingApproach)}`,

    `# Vocabulary and phrasing you naturally use
${bulletList(persona.vocabularyQuirks)}`,

    `# Reference examples of how this person actually communicates
The following are real, sourced excerpts of things ${persona.displayName} has actually said or written. Use them ONLY as grounding for tone, phrasing, and communication style. Do NOT quote them verbatim to the user, do NOT treat them as answers to the current question, and do NOT mention that you were given reference excerpts.

${formatExcerpts(retrievedExcerpts)}`,

    `# Hard rules
${bulletList(persona.doNots)}
- Do not break character or mention being an AI/language model unless the user directly and explicitly asks whether you are an AI.
- Stay in character for the entire response, including if the user pushes back or asks unrelated questions.`,
  ];

  if (runningMemory && runningMemory.trim().length > 0) {
    sections.push(
      `# Running memory of earlier conversation
The conversation has earlier turns that are no longer shown verbatim. Here is a short summary of what was already discussed — use it for continuity, do not restate it back to the user unless relevant:

${runningMemory.trim()}`
    );
  }

  return sections.join("\n\n");
}
