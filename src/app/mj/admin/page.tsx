import Link from "next/link";
import { AddPlayerForm, LoginForm, PlayerRow } from "@/components/mj/admin-forms";
import { SessionForm } from "@/components/mj/session-form";
import { SessionList } from "@/components/mj/session-list";
import { isAdmin } from "@/lib/mj/auth";
import { MIN_PLAYERS } from "@/lib/mj/parse";
import { listPlayers, listSessions } from "@/lib/mj/db";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

const h2 = "mb-3 text-sm font-semibold tracking-wide text-muted uppercase";

export default async function MjAdminPage({ searchParams }: PageProps<"/mj/admin">) {
  if (!(await isAdmin())) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin</h1>
        <LoginForm />
      </>
    );
  }

  const [players, sessions, params] = await Promise.all([
    listPlayers(),
    listSessions(),
    searchParams,
  ]);
  const notice = params.saved ? "Session saved." : params.deleted ? "Session deleted." : null;

  return (
    <>
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/mj" className="text-brand hover:underline">
            Leaderboard
          </Link>
          <Link href="/mj/zhahu" className="text-brand hover:underline">
            诈胡
          </Link>
          <form action={logout}>
            <button type="submit" className="cursor-pointer text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {notice ? (
        <p className="mt-4 rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className={h2}>New session</h2>
        {players.filter((p) => p.active).length < MIN_PLAYERS ? (
          <p className="text-sm text-muted">
            Add at least {MIN_PLAYERS} players below first.
          </p>
        ) : (
          // Keyed so the form resets to blank after each save.
          <SessionForm key={sessions.length} players={players} />
        )}
      </section>

      <section className="mt-10">
        <h2 className={h2}>Players</h2>
        <div className="space-y-2">
          {players.map((p) => (
            <PlayerRow key={p.id} player={p} />
          ))}
          <AddPlayerForm />
        </div>
        <p className="mt-2 text-xs text-faint">
          Aliases are the short names you can type in the results box, separated by
          commas. Matching ignores case. Untick &ldquo;Active&rdquo; to hide someone from the
          alias list without losing their history.
        </p>
      </section>

      <section className="mt-10">
        <h2 className={h2}>Past sessions</h2>
        <SessionList sessions={sessions} players={players} editable />
      </section>
    </>
  );
}
