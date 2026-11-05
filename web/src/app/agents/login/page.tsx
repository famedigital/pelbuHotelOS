import { AgentLoginForm } from "@/components/erp/AgentAuthForms";
import { BRAND_ICONS } from "@/lib/brand";
import { getAgentSession } from "@/lib/agent-auth";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Briefcase, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Travel Partner Portal Login · Hotel OS Bhutan",
  description: "Approved travel partners sign in to book and track credit.",
  robots: { index: false, follow: false },
};

export default async function AgentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAgentSession()) redirect("/agents/app");
  const sp = await searchParams;
  const error = sp.error?.trim() || undefined;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12 md:px-6">
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full blur-[140px] opacity-15"
        style={{
          background: "radial-gradient(circle, #0284c7 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between text-xs">
          <Link
            href="/login?switch=1"
            className="inline-flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>All Workspaces</span>
          </Link>

          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
            <Briefcase className="size-3" />
            <span>B2B Tour Operator</span>
          </span>
        </div>

        {/* Specular Glass Login Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-6 shadow-xl backdrop-blur-xl md:p-8">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/20"
            aria-hidden
          />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND_ICONS.mark}
                alt="Hotel OS Bhutan"
                className="h-11 w-11 rounded-xl object-contain ring-1 ring-border"
                width={44}
                height={44}
              />
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase">
                  Travel Partner Portal
                </p>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Agent Sign In
                </h1>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Use your partner agent code and secret PIN. Once authenticated, you
              will access signed MoU contract rates, room allocations, and city ledger credit.
            </p>
          </div>

          <div className="mt-6">
            <AgentLoginForm error={error} />
          </div>

          <div className="mt-6 space-y-2 border-t border-border/70 pt-4 text-center text-xs text-muted-foreground">
            <Link
              href="/agents"
              className="block font-medium text-primary hover:underline underline-offset-4"
            >
              Not an approved partner yet? Apply for bilateral MoU →
            </Link>
            <Link
              href="/login?switch=1"
              className="block hover:text-foreground underline-offset-4 hover:underline"
            >
              Use a different workspace
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/80">
            <ShieldCheck className="size-3 text-sky-500" />
            <span>Multi-Hotel Scoped MoU Rates • Live City Ledger</span>
          </div>
        </div>
      </div>
    </main>
  );
}
