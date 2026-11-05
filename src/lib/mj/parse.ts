import { parseCents } from "./money";
import type { Player, SessionResult } from "./types";

/**
 * Parses the free-text result box, one player per line:
 *
 *   sb -20
 *   Ah Boy +30.50
 *   mei $-10.50
 *
 * The amount is the last token; everything before it is a name or alias
 * (case-insensitive, so it may contain spaces). A bare number counts as a win.
 * A line with a name and no amount is "pending" — the form can fill it with
 * whatever balances the table. Shared by the client preview and the server
 * action, so the preview is exactly what gets saved.
 */

/** Longest player name. Keeps the pinned name column narrow on phones. */
export const MAX_NAME_LENGTH = 10;

/** A mahjong table needs at least four. Checked by the form and the server. */
export const MIN_PLAYERS = 4;

export type ParsedLine = {
  /** 1-based, for error messages. */
  lineNo: number;
  raw: string;
  /** The name or alias as typed. */
  who: string;
  player: Player | null;
  /** null when the line has no amount (pending) or an invalid one. */
  netCents: number | null;
  error: string | null;
};

export type ParseResult = {
  lines: ParsedLine[];
  /** Results ready to save, only meaningful when `errors` is empty. */
  results: SessionResult[];
  errors: string[];
  /** Sum of every valid amount. Zero when balanced. */
  gap: number;
  /** Lines naming a player but with no amount yet. */
  pending: ParsedLine[];
};

const normalise = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** lower-cased name or alias → player. */
export function aliasIndex(players: Player[]): Map<string, Player> {
  const index = new Map<string, Player>();
  for (const p of players) {
    for (const key of [p.name, ...p.aliases]) index.set(normalise(key), p);
  }
  return index;
}

const AMOUNT = /^[+-]?\$?[+-]?[\d,]*\.?\d+$/;

export function parseResults(text: string, players: Player[]): ParseResult {
  const index = aliasIndex(players);
  const seen = new Map<number, number>();
  const lines: ParsedLine[] = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    const trimmed = raw.trim();
    if (trimmed === "") return;
    const lineNo = i + 1;

    const tokens = trimmed.split(/\s+/);
    const last = tokens[tokens.length - 1];
    // A whole line that is itself a name ("Player 2") is a name, not an amount.
    const hasAmount =
      tokens.length > 1 && AMOUNT.test(last) && !index.has(normalise(trimmed));
    const who = hasAmount ? tokens.slice(0, -1).join(" ") : trimmed;

    let netCents: number | null = null;
    let error: string | null = null;
    if (hasAmount) {
      // "$-10" and "-$10" both mean minus ten.
      const negative = last.replace("$", "").startsWith("-");
      const cents = parseCents(last.replace(/[$+-]/g, ""));
      if (cents === null) error = `“${last}” isn't a valid amount (max 2 decimals)`;
      else netCents = negative ? -cents : cents;
    }

    const player = index.get(normalise(who)) ?? null;
    if (!player) {
      error = `“${who}” isn't a known player or alias`;
    } else if (seen.has(player.id)) {
      error = `${player.name} is already on line ${seen.get(player.id)}`;
    } else {
      seen.set(player.id, lineNo);
    }

    lines.push({ lineNo, raw: trimmed, who, player, netCents, error });
  });

  const errors = lines.filter((l) => l.error).map((l) => `Line ${l.lineNo}: ${l.error}`);
  const pending = lines.filter((l) => !l.error && l.netCents === null);
  const valid = lines.filter((l) => !l.error && l.netCents !== null);
  const gap = valid.reduce((sum, l) => sum + (l.netCents ?? 0), 0);

  return {
    lines,
    results: valid.map((l) => ({ playerId: l.player!.id, netCents: l.netCents! })),
    errors,
    gap,
    pending,
  };
}

/** The text an existing session is shown as when editing. */
export function resultsToText(results: SessionResult[], players: Player[]): string {
  const byId = new Map(players.map((p) => [p.id, p]));
  return results
    .map((r) => {
      const name = byId.get(r.playerId)?.name ?? `#${r.playerId}`;
      const sign = r.netCents < 0 ? "-" : "+";
      const abs = Math.abs(r.netCents);
      const amount = abs % 100 === 0 ? String(abs / 100) : (abs / 100).toFixed(2);
      return `${name} ${sign}${amount}`;
    })
    .join("\n");
}

/** Parse a comma-separated alias list from the admin form. */
export function parseAliasList(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(",")) {
    const alias = part.trim().replace(/\s+/g, " ");
    if (alias && !out.some((a) => a.toLowerCase() === alias.toLowerCase())) out.push(alias);
  }
  return out;
}
