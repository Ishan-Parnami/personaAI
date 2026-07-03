"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { applyTheme, getStoredTheme, getSystemTheme, type Theme } from "@/lib/theme";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTheme(getStoredTheme() ?? getSystemTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const doc = document as ViewTransitionDocument;
    const button = buttonRef.current;

    if (!doc.startViewTransition || !button) {
      setTheme(next);
      applyTheme(next);
      return;
    }

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    document.documentElement.style.setProperty("--theme-toggle-x", `${x}px`);
    document.documentElement.style.setProperty("--theme-toggle-y", `${y}px`);
    document.documentElement.classList.add("theme-transitioning");

    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        setTheme(next);
        applyTheme(next);
      });
    });
    void transition.finished.finally(() => {
      document.documentElement.classList.remove("theme-transitioning");
    });
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "dark"}
      className="glass flex h-9 w-9 items-center justify-center rounded-full transition hover:text-primary-500"
      style={{ color: "var(--fg-muted)" }}
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}
