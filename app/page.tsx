"use client";

import dynamic from "next/dynamic";
import PersonaSwitcher from "@/components/PersonaSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

const HeroOrb = dynamic(() => import("@/components/HeroOrb"), { ssr: false });

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden px-4 py-10 sm:py-16">
      {/* Abstract purple gradient blobs — pure CSS, no image assets. */}
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-primary-500), transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-primary-700), transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-xl -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(ellipse, var(--color-primary-400), transparent 70%)" }}
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
