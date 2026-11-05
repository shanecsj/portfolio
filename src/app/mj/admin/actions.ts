"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  endAdminSession,
  passwordMatches,
  requireAdmin,
  startAdminSession,
} from "@/lib/mj/auth";
import {
  adjustZhaHuCount,
  deleteSessionRow,
  insertPlayer,
  listPlayers,
  saveSessionRow,
  updatePlayer,
} from "@/lib/mj/db";
import { formatCents } from "@/lib/mj/money";
import { MAX_NAME_LENGTH, MIN_PLAYERS, aliasIndex, parseAliasList, parseResults } from "@/lib/mj/parse";

/*
 * Every export here is a public POST endpoint. Each one re-checks the admin
 * cookie and re-validates its input — the client form's checks are a
 * convenience, not a guarantee.
 */

export type ActionState = { error?: string; ok?: string } | null;

function refresh() {
  revalidatePath("/mj");
  revalidatePath("/mj/admin");
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "23505";
}

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  if (!passwordMatches(password)) {
    // Fixed delay to make guessing slow.
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "Wrong password." };
  }
  await startAdminSession();
  redirect("/mj/admin");
}

export async function logout(): Promise<void> {
  await endAdminSession();
  redirect("/mj");
}

function cleanName(raw: FormDataEntryValue | null): string | null {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= MAX_NAME_LENGTH ? name : null;
}

/**
 * Validate a name + alias list for player `selfId` (null when new). Every
 * name and alias must resolve to exactly one player, or the result box
 * couldn't tell them apart.
 */
async function checkNames(
  selfId: number | null,
  name: string,
  aliasInput: FormDataEntryValue | null,
): Promise<{ aliases: string[] } | { error: string }> {
  const aliases = parseAliasList(String(aliasInput ?? "")).filter(
    (a) => a.toLowerCase() !== name.toLowerCase(),
  );
  if (aliases.some((a) => a.length > 40)) return { error: "Aliases must be 40 characters or fewer." };
  if (aliases.some((a) => /^[+-]?\$?[\d,.]+$/.test(a))) {
    return { error: "An alias can't be just a number." };
  }
  const index = aliasIndex(await listPlayers());
  for (const key of [name, ...aliases]) {
    const owner = index.get(key.toLowerCase());
    if (owner && owner.id !== selfId) {
      return { error: `“${key}” is already used by ${owner.name}.` };
    }
  }
  return { aliases };
}

export async function addPlayer(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = cleanName(form.get("name"));
  if (!name) return { error: `Name must be 1–${MAX_NAME_LENGTH} characters.` };
  const checked = await checkNames(null, name, form.get("aliases"));
  if ("error" in checked) return checked;
  try {
    await insertPlayer(name, checked.aliases);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `${name} or one of those aliases is already taken.` };
    throw e;
  }
  refresh();
  return { ok: `Added ${name}.` };
}

export async function editPlayer(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = Number(form.get("id"));
  const name = cleanName(form.get("name"));
  if (!Number.isInteger(id)) return { error: "Unknown player." };
  if (!name) return { error: `Name must be 1–${MAX_NAME_LENGTH} characters.` };
  const checked = await checkNames(id, name, form.get("aliases"));
  if ("error" in checked) return checked;
  try {
    await updatePlayer(id, { name, active: form.get("active") === "on", aliases: checked.aliases });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `${name} or one of those aliases is already taken.` };
    throw e;
  }
  refresh();
  return { ok: "Saved." };
}

export type SessionPayload = {
  id: number | null;
  playedOn: string;
  notes: string;
  /** The raw result box, one "<alias> <amount>" per line. Parsed here again. */
  text: string;
  allowUnbalanced: boolean;
};

export async function saveSession(p: SessionPayload): Promise<ActionState> {
  await requireAdmin();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.playedOn) || Number.isNaN(Date.parse(p.playedOn))) {
    return { error: "Pick a valid date." };
  }
  if (typeof p.text !== "string" || p.text.length > 5000) {
    return { error: "Results text is missing or too long." };
  }

  const parsed = parseResults(p.text, await listPlayers());
  if (parsed.errors.length > 0) return { error: parsed.errors.join(" · ") };
  if (parsed.pending.length > 0) {
    return { error: `Line ${parsed.pending[0].lineNo} has no amount.` };
  }
  const { results, gap } = parsed;
  if (results.length < MIN_PLAYERS) {
    return { error: `A session needs at least ${MIN_PLAYERS} players.` };
  }
  if (results.some((r) => Math.abs(r.netCents) > 100_000_000)) {
    return { error: "That amount is too large." };
  }
  if (results.every((r) => r.netCents === 0)) {
    return { error: "Every amount is zero — nothing to record." };
  }
  if (gap !== 0 && !p.allowUnbalanced) {
    return {
      error: `Doesn't balance: off by ${formatCents(gap)}. Fix it, or tick “Save anyway”.`,
    };
  }

  await saveSessionRow(p.id, {
    playedOn: p.playedOn,
    notes: p.notes.trim().slice(0, 500) || null,
    balanced: gap === 0,
    results,
  });
  refresh();
  redirect("/mj/admin?saved=1");
}

export async function deleteSession(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  await deleteSessionRow(id);
  refresh();
  redirect("/mj/admin?deleted=1");
}

export async function adjustZhaHu(playerId: number, delta: number): Promise<void> {
  await requireAdmin();
  if (!Number.isInteger(playerId) || (delta !== 1 && delta !== -1)) return;
  await adjustZhaHuCount(playerId, delta);
  refresh();
}
