import { run, runTransaction, sql } from "./sql";
import type { Player, Session } from "./types";

/** Queries for /mj. Schema lives in scripts/mj-schema.sql; driver in ./sql.ts. */

export async function listPlayers(): Promise<Player[]> {
  const rows = await run(sql`
    SELECT p.id, p.name, p.active, p.zha_hu,
           coalesce(array_agg(a.alias ORDER BY lower(a.alias))
                    FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
    FROM players p
    LEFT JOIN player_aliases a ON a.player_id = p.id
    GROUP BY p.id
    ORDER BY p.active DESC, lower(p.name)`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    active: r.active,
    aliases: r.aliases,
    zhaHu: r.zha_hu,
  }));
}

/** All sessions, newest first, each with its results. */
export async function listSessions(): Promise<Session[]> {
  const rows = await run(sql`
    SELECT s.id, s.played_on::text AS played_on, s.notes, s.balanced,
           coalesce(
             json_agg(json_build_object('playerId', r.player_id, 'netCents', r.net_cents)
                      ORDER BY r.net_cents DESC)
               FILTER (WHERE r.player_id IS NOT NULL),
             '[]') AS results
    FROM sessions s
    LEFT JOIN results r ON r.session_id = s.id
    GROUP BY s.id
    ORDER BY s.played_on DESC, s.id DESC`);
  return rows.map((r) => ({
    id: r.id,
    playedOn: r.played_on,
    notes: r.notes,
    balanced: r.balanced,
    results: r.results,
  }));
}

export async function getSession(id: number): Promise<Session | null> {
  const all = await listSessions();
  return all.find((s) => s.id === id) ?? null;
}

export async function insertPlayer(name: string, aliases: string[]): Promise<void> {
  // One statement, so a player is never created without their aliases.
  await run(sql`
    WITH p AS (INSERT INTO players (name) VALUES (${name}) RETURNING id)
    INSERT INTO player_aliases (player_id, alias)
    SELECT p.id, a FROM p, unnest(${aliases}::text[]) AS a`);
}

export async function updatePlayer(
  id: number,
  fields: { name: string; active: boolean; aliases: string[] },
): Promise<void> {
  await runTransaction([
    sql`UPDATE players SET name = ${fields.name}, active = ${fields.active} WHERE id = ${id}`,
    sql`DELETE FROM player_aliases WHERE player_id = ${id}`,
    sql`
      INSERT INTO player_aliases (player_id, alias)
      SELECT ${id}, a FROM unnest(${fields.aliases}::text[]) AS a`,
  ]);
}

/** +1 or −1, never below zero. Atomic, so two quick taps both count. */
export async function adjustZhaHuCount(id: number, delta: 1 | -1): Promise<void> {
  await run(sql`UPDATE players SET zha_hu = greatest(0, zha_hu + ${delta}) WHERE id = ${id}`);
}

export type SessionInput = Omit<Session, "id">;

/** Insert, or replace an existing session and its results, atomically. */
export async function saveSessionRow(id: number | null, s: SessionInput): Promise<void> {
  const playerIds = s.results.map((r) => r.playerId);
  const nets = s.results.map((r) => r.netCents);

  if (id === null) {
    // One statement, so the session never exists without its results.
    await run(sql`
      WITH s AS (
        INSERT INTO sessions (played_on, notes, balanced)
        VALUES (${s.playedOn}, ${s.notes}, ${s.balanced})
        RETURNING id
      )
      INSERT INTO results (session_id, player_id, net_cents)
      SELECT s.id, t.player_id, t.net_cents
      FROM s, unnest(${playerIds}::int[], ${nets}::int[]) AS t(player_id, net_cents)`);
    return;
  }

  await runTransaction([
    sql`
      UPDATE sessions
      SET played_on = ${s.playedOn}, notes = ${s.notes},
          balanced = ${s.balanced}, updated_at = now()
      WHERE id = ${id}`,
    sql`DELETE FROM results WHERE session_id = ${id}`,
    sql`
      INSERT INTO results (session_id, player_id, net_cents)
      SELECT ${id}, t.player_id, t.net_cents
      FROM unnest(${playerIds}::int[], ${nets}::int[]) AS t(player_id, net_cents)`,
  ]);
}

export async function deleteSessionRow(id: number): Promise<void> {
  await run(sql`DELETE FROM sessions WHERE id = ${id}`);
}
