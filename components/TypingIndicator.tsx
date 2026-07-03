import { PERSONAS } from "@/lib/personaConfig";
import type { PersonaId } from "@/lib/personaConfig";

export default function TypingIndicator({ personaId }: { personaId: PersonaId }) {
  const persona = PERSONAS[personaId];
  return (
    <div className="flex items-end gap-2" aria-live="polite" aria-label={`${persona.displayName} is thinking`}>
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ backgroundColor: persona.accent }}
        aria-hidden="true"
      >
        {persona.initial}
      </div>
      <div className="glass flex items-center gap-1 rounded-2xl rounded-bl-sm px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500" />
      </div>
    </div>
  );
}
