"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 320);
  }
  root.dataset.theme = theme;
}

export function ThemeToggle() {
  // Server snapshot is null: the knob position is driven by CSS off
  // data-theme, so the markup is identical either way and nothing jumps.
  const theme = useSyncExternalStore<Theme | null>(
    subscribe,
    readTheme,
    () => null,
  );

  // Until the visitor picks a theme, keep following the OS setting live.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {}
      if (stored !== "light" && stored !== "dark") {
        applyTheme(mq.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isDark = theme === "dark";

  function toggle() {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={theme === null ? undefined : isDark}
      aria-label="Dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className="group relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border border-rule bg-surface p-0.5 transition-colors hover:border-faint"
    >
      {/* Track glyphs: the inactive icon peeks out on the side the knob isn't. */}
      <SunIcon className="absolute left-1.5 size-3.5 text-faint opacity-0 transition-opacity duration-300 dark:opacity-100" />
      <MoonIcon className="absolute right-1.5 size-3.5 text-faint opacity-100 transition-opacity duration-300 dark:opacity-0" />

      <span
        aria-hidden="true"
        className="relative grid size-5.5 place-items-center rounded-full bg-canvas text-brand shadow-sm ring-1 ring-rule transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-active:scale-90 motion-reduce:transition-none dark:translate-x-6"
      >
        <SunIcon className="col-start-1 row-start-1 size-3.5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
        <MoonIcon className="col-start-1 row-start-1 size-3.5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
      </span>
    </button>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}
