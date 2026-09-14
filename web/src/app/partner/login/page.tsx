"use client";

import { useActionState } from "react";
import Link from "next/link";
import { partnerLogin, type PlatformLoginState } from "@/app/actions/platform-auth";

const initial: PlatformLoginState = { ok: false };

export default function PartnerLoginPage() {
  const [state, action, pending] = useActionState(partnerLogin, initial);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Distributor
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Partner sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your Auth user must be linked in distributor_members.
          </p>
        </div>
        <form action={action} className="space-y-3">
          <input name="email" type="email" required placeholder="Email" className="w-full rounded-md border px-3 py-2 text-sm" />
          <input name="password" type="password" required placeholder="Password" className="w-full rounded-md border px-3 py-2 text-sm" />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <button type="submit" disabled={pending} className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link href="/login" className="text-xs underline text-muted-foreground">
          All logins
        </Link>
      </div>
    </main>
  );
}
