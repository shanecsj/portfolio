"use client";

import { useState, useTransition } from "react";
import { saveSession } from "@/app/mj/admin/actions";
import { formatCents } from "@/lib/mj/money";
import { MIN_PLAYERS, parseResults, resultsToText } from "@/lib/mj/parse";
import type { Player, Session } from "@/lib/mj/types";

function todaySG(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

function amountText(cents: number): string {
  const abs = Math.abs(cents);
  const n = abs % 100 === 0 ? String(abs / 100) : (abs / 100).toFixed(2);
  return `${cents < 0 ? "-" : "+"}${n}`;
}

function netClass(cents: number | null): string {
  if (cents === null) return "text-faint";
  if (cents > 0) return "text-emerald-700 dark:text-emerald-400";
  if (cents < 0) return "text-red-600 dark:text-red-400";
  return "text-muted";
}

const input =
  "rounded-md border border-rule bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint";

/**
 * New or edit session. Results are typed as free text, one "<alias> <amount>"
 * per line, and previewed live: who each line resolved to, any line that
 * didn't parse, and the running total, which must reach $0.00. The server
 * parses the same text again with the same parser before saving.
 */
export function SessionForm({
  players,
  session,
}: {
  players: Player[];
  session?: Session;
}) {
  const [playedOn, setPlayedOn] = useState(session?.playedOn ?? todaySG());
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [text, setText] = useState(session ? resultsToText(session.results, players) : "");
  const [allowUnbalanced, setAllowUnbalanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = parseResults(text, players);
  const { lines, gap, errors } = parsed;
  const valid = lines.filter((l) => !l.error && l.netCents !== null);
  const ready = errors.length === 0 && parsed.pending.length === 0 && valid.length >= MIN_PLAYERS;
  const balanced = ready && gap === 0;

  // Sign flipped: that value counted twice in the wrong direction.
  const flipped =
    gap !== 0 ? valid.find((l) => l.netCents !== 0 && l.netCents! * 2 === gap) : undefined;

  /** Put the balancing amount on the single line that has no amount yet. */
  function fillRemaining() {
    const target = parsed.pending[0];
    const rows = text.split(/\r?\n/);
    rows[target.lineNo - 1] = `${rows[target.lineNo - 1].trimEnd()} ${amountText(-gap)}`;
    setText(rows.join("\n"));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveSession({
        id: session?.id ?? null,
        playedOn,
        notes,
        text,
        allowUnbalanced,
      });
      if (res?.error) setError(res.error);
    });
  }

  const known = players.filter((p) => p.active);

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="grid max-w-[10rem] gap-1 text-xs text-muted">
        Date
        <input
          type="date"
          required
          value={playedOn}
          onChange={(e) => setPlayedOn(e.target.value)}
          className={input}
        />
      </label>

      <label className="grid gap-1 text-xs text-muted">
        Results — one per line: name or alias, then amount
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.max(5, text.split("\n").length + 1)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={"sb -20\nmei +30\njun -10"}
          className={`${input} font-mono leading-relaxed`}
        />
      </label>

      {/* Live preview of what each line resolved to. */}
      {lines.length > 0 ? (
        <ul className="space-y-0.5 text-sm">
          {lines.map((l) => (
            <li key={l.lineNo} className="flex items-baseline justify-between gap-3">
              {l.error ? (
                <span className="text-red-600 dark:text-red-400">
                  Line {l.lineNo}: {l.error}
                </span>
              ) : (
                <>
                  <span className="text-ink">
                    {l.player!.name}
                    {l.who.toLowerCase() === l.player!.name.toLowerCase() ? null : (
                      <span className="text-faint"> · “{l.who}”</span>
                    )}
                    {l.player!.active ? null : <span className="text-faint"> (inactive)</span>}
                  </span>
                  <span className={`tabular-nums ${netClass(l.netCents)}`}>
                    {l.netCents === null ? "no amount" : formatCents(l.netCents)}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Live zero-sum check. */}
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
          balanced
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            : "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300"
        }`}
      >
        <span>
          {balanced
            ? "Balanced ✓ — total is $0.00"
            : errors.length > 0
              ? `Fix ${errors.length} line${errors.length === 1 ? "" : "s"} above`
              : valid.length + parsed.pending.length < MIN_PLAYERS
                ? `Enter at least ${MIN_PLAYERS} players`
                : `Off by ${formatCents(gap)}`}
          {flipped && errors.length === 0 ? (
            <span className="block text-xs opacity-80">
              Is {flipped.player!.name}&rsquo;s {formatCents(flipped.netCents!)} meant to be{" "}
              {formatCents(-flipped.netCents!)}?
            </span>
          ) : null}
        </span>
        {errors.length === 0 && parsed.pending.length === 1 ? (
          <button
            type="button"
            onClick={fillRemaining}
            className="cursor-pointer rounded border border-current px-2 py-0.5 text-xs transition-colors hover:bg-current/10 active:scale-95"
          >
            Fill {parsed.pending[0].player!.name} with {formatCents(-gap)}
          </button>
        ) : null}
      </div>

      <label className="grid gap-1 text-xs text-muted">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
          className={input}
        />
      </label>

      {ready && gap !== 0 ? (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={allowUnbalanced}
            onChange={(e) => setAllowUnbalanced(e.target.checked)}
          />
          Save anyway and mark this session unbalanced
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !ready || (gap !== 0 && !allowUnbalanced)}
        className="cursor-pointer rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-85 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Saving…" : session ? "Save changes" : "Save session"}
      </button>

      {known.length > 0 ? (
        <details className="text-xs text-faint">
          <summary className="cursor-pointer hover:text-muted">Names and aliases</summary>
          <ul className="mt-2 space-y-0.5">
            {known.map((p) => (
              <li key={p.id}>
                <span className="text-muted">{p.name}</span>
                {p.aliases.length > 0 ? ` — ${p.aliases.join(", ")}` : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </form>
  );
}
