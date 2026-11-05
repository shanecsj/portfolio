"use client";

import { useActionState, useState } from "react";
import { addPlayer, editPlayer, login } from "@/app/mj/admin/actions";
import { MAX_NAME_LENGTH } from "@/lib/mj/parse";
import type { Player } from "@/lib/mj/types";

const input =
  "rounded-md border border-rule bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint";
const button =
  "cursor-pointer rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-85 active:scale-95 disabled:cursor-wait disabled:opacity-40";

function Message({ state }: { state: { error?: string; ok?: string } | null }) {
  if (state?.error) {
    return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>;
  }
  if (state?.ok) return <p className="text-sm text-muted">{state.ok}</p>;
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="mt-6 flex max-w-sm flex-col gap-3">
      <input
        type="password"
        name="password"
        required
        autoComplete="current-password"
        placeholder="Admin password"
        aria-label="Admin password"
        className={input}
      />
      <button type="submit" disabled={pending} className={`${button} self-start`}>
        {pending ? "Checking…" : "Sign in"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function AddPlayerForm() {
  const [state, action, pending] = useActionState(addPlayer, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="name"
        required
        maxLength={MAX_NAME_LENGTH}
        placeholder={`Name (max ${MAX_NAME_LENGTH})`}
        aria-label="New player name"
        className={`${input} min-w-0 flex-1`}
      />
      <input
        name="aliases"
        placeholder="Aliases, comma-separated"
        aria-label="Aliases for the new player, comma-separated"
        className={`${input} min-w-0 flex-1`}
      />
      <button type="submit" disabled={pending} className={button}>
        Add
      </button>
      <div className="w-full">
        <Message state={state} />
      </div>
    </form>
  );
}

export function PlayerRow({ player }: { player: Player }) {
  const [state, action, pending] = useActionState(editPlayer, null);
  // Edited since the last save: the button fills in so unsaved rows stand out.
  const [dirty, setDirty] = useState(false);
  const saved = !dirty && !pending && state?.ok;

  return (
    <form
      action={action}
      onChange={() => setDirty(true)}
      onSubmit={() => setDirty(false)}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={player.id} />
      <input
        name="name"
        defaultValue={player.name}
        required
        maxLength={MAX_NAME_LENGTH}
        aria-label={`Name for ${player.name}`}
        className={`${input} min-w-0 flex-1 py-1`}
      />
      <input
        name="aliases"
        defaultValue={player.aliases.join(", ")}
        placeholder="Aliases"
        aria-label={`Aliases for ${player.name}, comma-separated`}
        className={`${input} min-w-0 flex-1 py-1`}
      />
      <label className="flex items-center gap-1 text-xs text-muted">
        <input type="checkbox" name="active" defaultChecked={player.active} />
        Active
      </label>
      <button
        type="submit"
        disabled={pending}
        className={`w-20 cursor-pointer rounded-md border px-3 py-1 text-xs transition-colors active:scale-95 disabled:cursor-wait disabled:opacity-60 ${
          dirty
            ? "border-ink bg-ink text-canvas hover:opacity-85"
            : saved
              ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
              : "border-rule text-ink hover:border-ink hover:bg-surface"
        }`}
      >
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
      {state?.error ? (
        <div className="w-full">
          <Message state={state} />
        </div>
      ) : null}
    </form>
  );
}

/** Delete needs a confirm — there's no undo. */
export function ConfirmDeleteButton() {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm("Delete this session? This can't be undone.")) e.preventDefault();
      }}
      className="cursor-pointer rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-500/10 active:scale-95 dark:text-red-400"
    >
      Delete this session
    </button>
  );
}
