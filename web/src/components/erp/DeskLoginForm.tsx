"use client";

import { deskLogin, type DeskLoginState } from "@/app/actions/desk";
import { useActionState } from "react";

const initial: DeskLoginState = { ok: false };

export function DeskLoginForm() {
  const [state, action, pending] = useActionState(deskLogin, initial);

  return (
    <form action={action} className="mx-auto max-w-sm space-y-4" noValidate>
      <label className="block text-sm text-muted">
        Desk PIN
        <input
          type="password"
          name="pin"
          required
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-gold px-6 text-sm font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "Opening…" : "Open desk"}
      </button>
    </form>
  );
}
