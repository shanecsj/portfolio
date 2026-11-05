import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDeleteButton } from "@/components/mj/admin-forms";
import { SessionForm } from "@/components/mj/session-form";
import { formatDate } from "@/components/mj/session-list";
import { requireAdmin } from "@/lib/mj/auth";
import { getSession, listPlayers } from "@/lib/mj/db";
import { deleteSession } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditSessionPage({
  params,
}: PageProps<"/mj/admin/sessions/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [session, players] = await Promise.all([getSession(id), listPlayers()]);
  if (!session) notFound();

  return (
    <>
      <p className="text-sm">
        <Link href="/mj/admin" className="text-brand hover:underline">
          ← Admin
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        Edit {formatDate(session.playedOn)}
      </h1>

      <div className="mt-6">
        <SessionForm players={players} session={session} />
      </div>

      <form action={deleteSession} className="mt-12 border-t border-rule pt-6">
        <input type="hidden" name="id" value={session.id} />
        <ConfirmDeleteButton />
      </form>
    </>
  );
}
