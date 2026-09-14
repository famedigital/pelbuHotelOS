"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  platformAdminLogin,
  type PlatformLoginState,
} from "@/app/actions/platform-auth";

const initial: PlatformLoginState = { ok: false };

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(platformAdminLogin, initial);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Platform
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Admin sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Fame Digital only. Your email must be listed in
            PLATFORM_ADMIN_EMAILS or platform_admins.
          </p>
        </div>
        <form action={action} className="space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link href="/login" className="text-xs text-muted-foreground underline">
          All logins
        </Link>
      </div>
    </main>
  );
}
