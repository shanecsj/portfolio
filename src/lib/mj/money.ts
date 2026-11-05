/**
 * Money is held as integer cents end to end. Summing floats would let
 * 0.1 + 0.2 drift off zero and trip the balance check on a balanced table.
 */

/** "12.4" → 1240, "-5" → -500, "" → null. Rejects more than 2 decimals. */
export function parseCents(input: string): number | null {
  const s = input.trim().replace(/[$,\s]/g, "");
  if (s === "" || s === "-" || s === "+") return null;
  const m = /^([+-])?(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m || (m[2] === "" && !m[3])) return null;
  const whole = Number(m[2] || "0");
  const frac = Number((m[3] ?? "").padEnd(2, "0") || "0");
  const cents = whole * 100 + frac;
  return m[1] === "-" ? -cents : cents;
}

/** 1240 → "12.40" (no sign, no symbol) — for prefilling inputs. */
export function centsToInput(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2);
}

/** 1240 → "+$12.40", -500 → "−$5.00", 0 → "$0.00". */
export function formatCents(cents: number, { signed = true } = {}): string {
  const abs = (Math.abs(cents) / 100).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!signed || cents === 0) return `$${abs}`;
  return `${cents > 0 ? "+" : "−"}$${abs}`;
}
