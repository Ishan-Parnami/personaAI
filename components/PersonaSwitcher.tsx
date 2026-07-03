"use client";

import { useRouter } from "next/navigation";
import { PERSONAS, type PersonaId } from "@/lib/personaConfig";

/**
 * Landing-page persona picker. Persona switching happens here, before entering
 * a chat — there is no in-chat switcher for this step.
 */
export default function PersonaSwitcher() {
  const router = useRouter();

  function choose(personaId: PersonaId) {
    router.push(`/chat?persona=${personaId}`);
  }

  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
      {Object.values(PERSONAS).map((persona) => (
        <button
          key={persona.id}
          type="button"
          onClick={() => choose(persona.id)}
          className="glass group flex flex-col items-start gap-3 rounded-3xl p-6 text-left transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-500/10"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold text-white"
            style={{ backgroundColor: persona.accent }}
            aria-hidden="true"
          >
            {persona.initial}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{persona.displayName}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)" }}>
              {persona.tagline}
            </p>
          </div>
          <span className="mt-2 text-sm font-medium text-primary-600 transition group-hover:translate-x-0.5 dark:text-primary-400">
            Start chatting →
          </span>
        </button>
      ))}
    </div>
  );
}
