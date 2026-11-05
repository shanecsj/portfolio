"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type MjBoard = {
  /** Value of ?tab=. The first board is the default and has no param. */
  id: string;
  label: string;
  /** Small text beside the heading, e.g. "12 sessions". */
  meta: ReactNode;
  content: ReactNode;
};

/**
 * Header + tabs for the public /mj boards. The server renders every board in
 * one response, so switching tabs only toggles visibility: no request, no
 * loading state. The choice is mirrored into ?tab= with replaceState so a
 * link or reload lands on the same board.
 */
export function MjBoards({ boards }: { boards: MjBoard[] }) {
  const param = useSearchParams().get("tab");
  const active = boards.find((b) => b.id === param) ?? boards[0];

  function select(id: string) {
    const url = new URL(window.location.href);
    if (id === boards[0].id) url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    // Integrates with the Next router (useSearchParams updates) without a fetch.
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">372A MJ</h1>
        <p className="text-xs text-faint">{active.meta}</p>
      </header>

      <div
        role="tablist"
        aria-label="Boards"
        className="mt-4 flex gap-5 border-b border-rule text-sm"
      >
        {boards.map((b) => {
          const selected = b.id === active.id;
          return (
            <button
              key={b.id}
              type="button"
              role="tab"
              id={`tab-${b.id}`}
              aria-selected={selected}
              aria-controls={`panel-${b.id}`}
              onClick={() => select(b.id)}
              className={`-mb-px cursor-pointer border-b-2 pb-2 ${
                selected
                  ? "border-brand font-medium text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Hidden rather than unmounted, so each board keeps its state. */}
      {boards.map((b) => (
        <div
          key={b.id}
          role="tabpanel"
          id={`panel-${b.id}`}
          aria-labelledby={`tab-${b.id}`}
          hidden={b.id !== active.id}
        >
          {b.content}
        </div>
      ))}
    </>
  );
}
