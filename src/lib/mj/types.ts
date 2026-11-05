export type Player = {
  id: number;
  name: string;
  active: boolean;
  /** Other names this player can be entered under. */
  aliases: string[];
  /** Zha hu (false win) count. */
  zhaHu: number;
};

export type SessionResult = {
  playerId: number;
  netCents: number;
};

export type Session = {
  id: number;
  /** ISO date, YYYY-MM-DD. */
  playedOn: string;
  notes: string | null;
  balanced: boolean;
  results: SessionResult[];
};
