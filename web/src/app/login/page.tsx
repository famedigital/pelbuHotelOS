import { getAgentSession } from "@/lib/agent-auth";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { BRAND_ICONS } from "@/lib/brand";
import { getStaffSession } from "@/lib/staff-auth";
import { SITE_NAME } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login",
  description: "Choose hotel desk or travel agent portal.",
  robots: { index: false, follow: false },
};

/** Chooser: hotel desk (eZee) vs travel agents. */
export default async function LoginHubPage() {
  if (await isDeskAuthenticated()) redirect("/erp");
  const staff = await getStaffSession();
  if (staff) redirect(staff.canAccessDesk ? "/erp" : "/staff");
  if (await getAgentSession()) redirect("/agents/app");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_ICONS.mark}
            alt={SITE_NAME}
            className="h-12 w-12 object-contain"
            width={48}
            height={48}
          />
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            {SITE_NAME}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Hotel staff and travel agents use different portals.
          </p>
        </div>

        <div className="grid gap-3">
          <Link
            href="/erp/login"
            className="rounded-xl border border-border bg-card px-5 py-4 transition hover:border-primary/40 hover:bg-muted/40"
          >
            <p className="font-semibold text-foreground">Hotel desk</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Hotel code + User ID + Password (front office / ERP)
            </p>
          </Link>
          <Link
            href="/agents/login"
            className="rounded-xl border border-border bg-card px-5 py-4 transition hover:border-primary/40 hover:bg-muted/40"
          >
            <p className="font-semibold text-foreground">Travel agent</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Agent code + PIN — one login for every hotel that linked you
            </p>
          </Link>
          <Link
            href="/staff/login"
            className="rounded-xl border border-dashed border-border px-5 py-3 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Staff HR portal →
          </Link>
        </div>

        <Link
          href="/"
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to {SITE_NAME}
        </Link>
      </div>
    </main>
  );
}
