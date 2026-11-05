import Link from "next/link";
import { MjBoards } from "@/components/mj/mj-boards";
import { SessionList, netClass } from "@/components/mj/session-list";
import { ZhaHuBoard, type ZhaHuRow } from "@/components/mj/zha-hu-board";
import { isAdmin } from "@/lib/mj/auth";
import { listPlayers, listSessions } from "@/lib/mj/db";
import { formatCents } from "@/lib/mj/money";
import { sessionGap, standings } from "@/lib/mj/stats";
import type { Player, Session } from "@/lib/mj/types";

// Reads the database on every request; there's nothing to prerender at build.
export const dynamic = "force-dynamic";

/** Secondary stat columns: de-emphasised. On phones they start off-screen. */
const detail = "py-2.5 pl-3 text-right text-xs font-normal whitespace-nowrap text-faint";

/**
 * # and Player stay pinned while the table scrolls sideways. They need an
 * opaque background so the columns sliding underneath don't show through.
 * The page gutter lives inside the # cell (pl-4) rather than on the scroll
 * wrapper, so the pinned column keeps its margin from the screen edge.
 */
const pinRank = "sticky left-0 z-10 bg-canvas pl-4";
// w-px + nowrap shrinks the column to the longest name (max 10 characters).
const pinName =
  "sticky left-12 z-10 w-px whitespace-nowrap bg-canvas shadow-[1px_0_0_var(--rule)] sm:shadow-none";

/** Washed-out win/loss colour for the secondary money columns. */
function paleNetClass(cents: number): string {
  if (cents > 0) return "text-emerald-600/60! dark:text-emerald-400/60!";
  if (cents < 0) return "text-red-500/60! dark:text-red-400/60!";
  return "";
}

/**
 * Both public boards (leaderboard and 诈胡) come from this one request; the
 * tabs in MjBoards switch between them on the client without fetching.
 */
export default async function MjPage() {
  const [players, sessions, admin] = await Promise.all([
    listPlayers(),
    listSessions(),
    isAdmin(),
  ]);
  const zhaHu = zhaHuRows(players);
  const zhaHuTotal = players.reduce((sum, p) => sum + p.zhaHu, 0);

  return (
    <>
      <MjBoards
        boards={[
          {
            id: "leaderboard",
            label: "Leaderboard",
            meta: `${sessions.length} session${sessions.length === 1 ? "" : "s"}`,
            content: <Leaderboard players={players} sessions={sessions} />,
          },
          {
            id: "zhahu",
            label: "诈胡",
            meta: `${zhaHuTotal} 诈胡 so far`,
            content: (
              <section className="mt-8">
                {zhaHu.length === 0 ? (
                  <p className="text-sm text-muted">No players yet.</p>
                ) : (
                  <ZhaHuBoard rows={zhaHu} editable={admin} />
                )}
                {admin ? (
                  <p className="mt-3 text-xs text-faint">
                    You&rsquo;re signed in as admin, so you can adjust counts here.
                  </p>
                ) : null}
              </section>
            ),
          },
        ]}
      />

      <p className="mt-12 text-xs text-faint">
        <Link href="/mj/admin" className="hover:text-muted">
          Admin
        </Link>
      </p>
    </>
  );
}

/** Inactive players show only if they have a count. Ties share a rank (1, 2, 2, 4). */
function zhaHuRows(players: Player[]): ZhaHuRow[] {
  const sorted = players
    .filter((p) => p.active || p.zhaHu > 0)
    .sort((a, b) => b.zhaHu - a.zhaHu || a.name.localeCompare(b.name));
  return sorted.map((p) => ({
    id: p.id,
    name: p.name,
    count: p.zhaHu,
    rank: sorted.findIndex((q) => q.zhaHu === p.zhaHu) + 1,
  }));
}

function Leaderboard({ players, sessions }: { players: Player[]; sessions: Session[] }) {
  const rows = standings(players, sessions);
  const unbalanced = sessions.filter((s) => sessionGap(s) !== 0);
  const ledgerGap = unbalanced.reduce((sum, s) => sum + sessionGap(s), 0);

  return (
    <>
      {unbalanced.length > 0 ? (
        <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          ⚠ {unbalanced.length} session{unbalanced.length === 1 ? " doesn't" : "s don't"} sum
          to zero, so the ledger is off by {formatCents(ledgerGap)} overall.
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
          Leaderboard
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No results yet.</p>
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto">
              {/* Total and Played carry the board; the five detail columns are small
                  and pale. On phones the table is exactly one screen plus the detail
                  columns' 27rem, so the first four columns fill the screen and
                  the rest wait off the right edge until you swipe. */}
              <table className="w-[calc(100%+27rem)] text-sm tabular-nums sm:w-full">
                <colgroup>
                  <col className="w-12" />
                  {/* Player sizes to its content; Total takes the leftover width. */}
                  <col />
                  <col />
                  <col className="w-16" />
                  <col className="w-24" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-24" />
                </colgroup>
                <thead className="text-left text-xs text-faint">
                  <tr className="border-b border-rule">
                    <th className={`${pinRank} py-2 pr-2 font-normal`}>#</th>
                    <th className={`${pinName} py-2 pr-2 font-normal`}>Player</th>
                    <th className="py-2 pr-3 text-right font-medium text-muted">Total</th>
                    <th className="py-2 pr-2 text-right font-medium text-muted">Played</th>
                    <th className={`${detail} pl-6`}>Win %</th>
                    <th className={detail}>Average</th>
                    <th className={detail}>Best</th>
                    <th className={detail}>Worst</th>
                    <th className={`${detail} pr-4`}>Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.player.id} className="border-b border-rule">
                      <td className={`${pinRank} py-2.5 pr-2 text-faint`}>{r.rank}</td>
                      <td className={`${pinName} py-2.5 pr-2 font-medium text-ink`}>
                        {r.player.name}
                      </td>
                      <td
                        className={`py-2.5 pr-3 text-right text-base ${netClass(r.totalCents)}`}
                      >
                        {formatCents(r.totalCents)}
                      </td>
                      <td className="py-2.5 pr-2 text-right text-ink">{r.sessions}</td>
                      <td className={`${detail} pl-6`}>{Math.round(r.winRate * 100)}%</td>
                      <td className={`${detail} ${paleNetClass(r.avgCents)}`}>{formatCents(r.avgCents)}</td>
                      <td className={`${detail} ${paleNetClass(r.bestCents)}`}>{formatCents(r.bestCents)}</td>
                      <td className={`${detail} ${paleNetClass(r.worstCents)}`}>
                        {formatCents(r.worstCents)}
                      </td>
                      <td className={`${detail} pr-4`}>
                        {r.streak === 0 ? "–" : r.streak > 0 ? `W${r.streak}` : `L${-r.streak}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-faint sm:hidden">Swipe the table for more stats →</p>
          </>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
          Sessions
        </h2>
        <SessionList sessions={sessions} players={players} />
      </section>

    </>
  );
}
