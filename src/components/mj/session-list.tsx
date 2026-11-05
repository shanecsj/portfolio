import Link from "next/link";
import { formatCents } from "@/lib/mj/money";
import { sessionGap } from "@/lib/mj/stats";
import type { Player, Session, SessionResult } from "@/lib/mj/types";

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function netClass(cents: number): string {
  if (cents > 0) return "text-emerald-700 dark:text-emerald-400";
  if (cents < 0) return "text-red-600 dark:text-red-400";
  return "text-muted";
}

/** Session history, newest first. `editable` adds edit links for the admin. */
export function SessionList({
  sessions,
  players,
  editable = false,
}: {
  sessions: Session[];
  players: Player[];
  editable?: boolean;
}) {
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  if (sessions.length === 0) {
    return <p className="text-sm text-muted">No sessions recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {sessions.map((s) => {
        const gap = sessionGap(s);
        return (
          <li key={s.id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium text-ink">
                {formatDate(s.playedOn)}
              </p>
              <div className="flex items-center gap-3 text-xs">
                {!s.balanced || gap !== 0 ? (
                  <span
                    title="This session's results don't sum to zero"
                    className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-800 dark:text-amber-300"
                  >
                    ⚠ off by {formatCents(gap)}
                  </span>
                ) : null}
                {editable ? (
                  <Link href={`/mj/admin/sessions/${s.id}`} className="text-brand hover:underline">
                    Edit
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-6 text-sm">
              <ResultColumn
                label="Won"
                results={s.results.filter((r) => r.netCents > 0)}
                nameOf={nameOf}
              />
              <ResultColumn
                label="Lost"
                // Biggest loss first; anyone who broke even goes last.
                results={s.results
                  .filter((r) => r.netCents <= 0)
                  .sort((a, b) => a.netCents - b.netCents)}
                nameOf={nameOf}
              />
            </div>
            {s.notes ? <p className="mt-1 text-xs text-faint">{s.notes}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function ResultColumn({
  label,
  results,
  nameOf,
}: {
  label: string;
  results: SessionResult[];
  nameOf: Map<number, string>;
}) {
  return (
    <ul aria-label={label} className="min-w-0 space-y-0.5">
      {results.map((r) => (
        <li key={r.playerId} className="flex items-baseline justify-between gap-2">
          <span className="truncate text-muted">{nameOf.get(r.playerId) ?? "?"}</span>
          <span className={`shrink-0 tabular-nums ${netClass(r.netCents)}`}>
            {formatCents(r.netCents)}
          </span>
        </li>
      ))}
    </ul>
  );
}
