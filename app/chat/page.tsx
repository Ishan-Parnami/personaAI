"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ChatWindow from "@/components/ChatWindow";
import ThemeToggle from "@/components/ThemeToggle";
import { PERSONAS, isPersonaId } from "@/lib/personaConfig";

function ChatPageInner() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("persona");

  if (!isPersonaId(requested)) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p style={{ color: "var(--fg-muted)" }}>
          No persona selected. Please choose one to start chatting.
        </p>
        <Link
          href="/"
          className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white dark:bg-primary-500 dark:text-black"
        >
          Choose a persona
        </Link>
      </div>
    );
  }

  const persona = PERSONAS[requested];

  return (
    <div className="flex h-dvh flex-col">
      <header
        className="glass flex shrink-0 items-center justify-between px-4 py-3 sm:px-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back to persona picker"
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-primary-500/10"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: persona.accent }}
            aria-hidden="true"
          >
            {persona.initial}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{persona.displayName}</p>
            <p className="text-xs leading-tight" style={{ color: "var(--fg-muted)" }}>
              {persona.tagline}
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="min-h-0 flex-1">
        <ChatWindow personaId={requested} />
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
