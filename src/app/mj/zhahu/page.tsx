import type { Metadata } from "next";
import Link from "next/link";
import { MjTabs } from "@/components/mj/mj-tabs";
import { ZhaHuBoard, type ZhaHuRow } from "@/components/mj/zha-hu-board";
import { isAdmin } from "@/lib/mj/auth";
import { listPlayers } from "@/lib/mj/db";

export const metadata: Metadata = { title: "诈胡" };

export const dynamic = "force-dynamic";

/**
 * Zha hu (false win) tally. Everyone sees the ranking; the admin also gets
 * −/+ buttons on each row. Inactive players show only if they have a count.
 */
export default async function ZhaHuPage() {
  const [players, admin] = await Promise.all([listPlayers(), isAdmin()]);

  const sorted = players
    .filter((p) => p.active || p.zhaHu > 0)
    .sort((a, b) => b.zhaHu - a.zhaHu || a.name.localeCompare(b.name));
  const rows: ZhaHuRow[] = sorted.map((p) => ({
    id: p.id,
    name: p.name,
    count: p.zhaHu,
    // Ties share a rank (1, 2, 2, 4).
    rank: sorted.findIndex((q) => q.zhaHu === p.zhaHu) + 1,
  }));
  const total = players.reduce((sum, p) => sum + p.zhaHu, 0);

  return (
    <>
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">372A MJ</h1>
        <p className="text-xs text-faint">
          {total} 诈胡 so far
        </p>
      </header>
      <MjTabs current="/mj/zhahu" />

      <section className="mt-8">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No players yet.</p>
        ) : (
          <ZhaHuBoard rows={rows} editable={admin} />
        )}
        {admin ? (
          <p className="mt-3 text-xs text-faint">
            You&rsquo;re signed in as admin, so you can adjust counts here.
          </p>
        ) : null}
      </section>

      <p className="mt-12 text-xs text-faint">
        <Link href="/mj/admin" className="hover:text-muted">
          Admin
        </Link>
      </p>
    </>
  );
}
