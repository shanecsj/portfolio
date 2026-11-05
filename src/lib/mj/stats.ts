import type { Player, Session } from "./types";

export type Standing = {
  player: Player;
  rank: number;
  totalCents: number;
  sessions: number;
  wins: number;
  winRate: number;
  avgCents: number;
  bestCents: number;
  worstCents: number;
  /** +n = n winning sessions in a row, −n = n losing, 0 = last was flat. */
  streak: number;
};

/** Sum of a session's nets. Zero for a balanced session. */
export function sessionGap(session: Session): number {
  return session.results.reduce((sum, r) => sum + r.netCents, 0);
}

/**
 * Overall ranking by total net. Ties share a rank (1, 2, 2, 4). Players with
 * no sessions are left out so the board isn't padded with zeros.
 */
export function standings(players: Player[], sessions: Session[]): Standing[] {
  // Oldest first, so the streak walk ends on the most recent session.
  const ordered = [...sessions].sort(
    (a, b) => a.playedOn.localeCompare(b.playedOn) || a.id - b.id,
  );

  const rows = players
    .map((player) => {
      const nets = ordered.flatMap((s) =>
        s.results.filter((r) => r.playerId === player.id).map((r) => r.netCents),
      );
      if (nets.length === 0) return null;

      const total = nets.reduce((a, b) => a + b, 0);
      const wins = nets.filter((n) => n > 0).length;

      let streak = 0;
      const last = Math.sign(nets[nets.length - 1]);
      if (last !== 0) {
        for (let i = nets.length - 1; i >= 0 && Math.sign(nets[i]) === last; i--) {
          streak += last;
        }
      }

      return {
        player,
        rank: 0,
        totalCents: total,
        sessions: nets.length,
        wins,
        winRate: wins / nets.length,
        avgCents: Math.round(total / nets.length),
        bestCents: Math.max(...nets),
        worstCents: Math.min(...nets),
        streak,
      };
    })
    .filter((r): r is Standing => r !== null)
    .sort((a, b) => b.totalCents - a.totalCents || b.winRate - a.winRate);

  rows.forEach((row, i) => {
    row.rank =
      i > 0 && rows[i - 1].totalCents === row.totalCents ? rows[i - 1].rank : i + 1;
  });
  return rows;
}
