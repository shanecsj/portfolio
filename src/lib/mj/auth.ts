import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Single-admin auth. The cookie is `<expiryMs>.<hmac>` signed with
 * MJ_SESSION_SECRET — stateless, no session table, no library.
 *
 * Every server action must call requireAdmin() itself: actions are reachable
 * by direct POST, so a check on the page alone protects nothing.
 */

const COOKIE = "mj_admin";
const MAX_AGE_S = 60 * 60 * 24 * 30;

function secret(): string {
  const s = process.env.MJ_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("MJ_SESSION_SECRET must be set to at least 32 characters.");
  }
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Buffer.from(sig).toString("base64url");
}

/** Constant-time string compare, so timing doesn't leak how much matched. */
function safeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.MJ_ADMIN_PASSWORD;
  if (!expected) throw new Error("MJ_ADMIN_PASSWORD is not set.");
  return safeEqual(input, expected);
}

export async function startAdminSession(): Promise<void> {
  const expires = Date.now() + MAX_AGE_S * 1000;
  const value = `${expires}.${await hmac(String(expires))}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/mj",
    maxAge: MAX_AGE_S,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/mj" });
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [expires, sig] = value.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return safeEqual(sig, await hmac(expires));
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/mj/admin");
}
