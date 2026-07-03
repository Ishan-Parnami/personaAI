"use client";

import dynamic from "next/dynamic";
import PersonaSwitcher from "@/components/PersonaSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

const HeroOrb = dynamic(() => import("@/components/HeroOrb"), { ssr: false });

export default function Home() {
  return (
    <div
      className="relative flex min-h-dvh flex-col items-center overflow-hidden px-4 py-10 sm:py-16"
      style={{ background: "radial-gradient(circle at 50% 0%, var(--hero-wash), var(--bg) 60%)" }}
    >
      {/* Abstract purple gradient blobs — pure CSS, no image assets. */}
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-128 w-[32rem] rounded-full opacity-90 blur-3xl dark:opacity-40 dark:h-96 dark:w-96"
        style={{ background: "radial-gradient(circle, var(--color-primary-300), transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 top-1/3 h-112 w-[28rem] rounded-full opacity-80 blur-3xl dark:opacity-30 dark:h-80 dark:w-80"
        style={{ background: "radial-gradient(circle, var(--color-primary-500), transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 left-1/2 h-112 w-3xl -translate-x-1/2 rounded-full opacity-70 blur-3xl dark:opacity-20 dark:h-72 dark:w-xl"
        style={{ background: "radial-gradient(ellipse, var(--color-primary-200), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative flex w-full max-w-4xl flex-col items-center gap-2 pt-6 text-center">
        <HeroOrb />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Persona AI</h1>
        <p className="max-w-md text-sm sm:text-base" style={{ color: "var(--fg-muted)" }}>
          Chat with an AI simulating Hitesh Choudhary or Piyush Garg. Pick a persona to begin.
        </p>
      </div>

      <div className="relative mt-10 flex w-full flex-1 items-center justify-center">
        <PersonaSwitcher />
      </div>
    </div>
  );
}
