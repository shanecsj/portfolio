"use client";

import { useOptimistic, useTransition } from "react";
import { adjustZhaHu } from "@/app/mj/admin/actions";

export type ZhaHuRow = { id: number; name: string; count: number; rank: number };

const step =
  "h-8 w-8 cursor-pointer rounded-md border border-rule text-base leading-none text-ink transition-colors hover:border-ink hover:bg-surface active:scale-95 disabled:cursor-not-allowed disabled:opacity-30";

/**
 * The zha hu table. When `editable`, each row gets −/+ buttons; the count
 * updates optimistically and the server action (which re-checks the admin
 * cookie) makes it stick.
 */
export function ZhaHuBoard({ rows, editable }: { rows: ZhaHuRow[]; editable: boolean }) {
  const [, startTransition] = useTransition();
  const [counts, bump] = useOptimistic(
    new Map(rows.map((r) => [r.id, r.count])),
    (state, { id, delta }: { id: number; delta: number }) =>
      new Map(state).set(id, Math.max(0, (state.get(id) ?? 0) + delta)),
  );

  function change(id: number, delta: 1 | -1) {
    startTransition(async () => {
      bump({ id, delta });
      await adjustZhaHu(id, delta);
    });
  }

  return (
    <table className="w-full text-sm tabular-nums">
      <thead className="text-left text-xs text-faint">
        <tr className="border-b border-rule">
          <th className="w-8 py-2 pr-2 font-normal">#</th>
          <th className="py-2 pr-2 font-normal">Player</th>
          <th className="py-2 text-right font-normal">诈胡</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const count = counts.get(r.id) ?? 0;
          return (
            <tr key={r.id} className="border-b border-rule">
              <td className="py-2 pr-2 text-faint">{r.rank}</td>
              <td className="py-2 pr-2 font-medium text-ink">{r.name}</td>
              <td className="py-2 text-right">
                {editable ? (
                  <span className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => change(r.id, -1)}
                      disabled={count === 0}
                      aria-label={`Remove one 诈胡 from ${r.name}`}
                      className={step}
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-semibold text-ink">{count}</span>
                    <button
                      type="button"
                      onClick={() => change(r.id, 1)}
                      aria-label={`Add one 诈胡 to ${r.name}`}
                      className={step}
                    >
                      +
                    </button>
                  </span>
                ) : (
                  <span className="font-semibold text-ink">{count}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
