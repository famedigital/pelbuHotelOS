import { AgentLoginForm } from "@/components/erp/AgentAuthForms";
import { BRAND_ICONS } from "@/lib/brand";
import { getAgentSession } from "@/lib/agent-auth";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Agent login | Pelbu Suites",
  description: "Approved travel partners sign in to book and track credit.",
  robots: { index: false, follow: false },
};

export default async function AgentLoginPage() {
  if (await getAgentSession()) redirect("/agents/app");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_ICONS.mark}
            alt="Pelbu Suites"
            className="h-12 w-12 object-contain"
            width={48}
            height={48}
          />
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              Travel partner
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Agent sign in
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the agent code and PIN issued by the Pelbu desk to book on your
              rate and track credit.
            </p>
          </div>
        </div>
        <AgentLoginForm />
        <div className="space-y-2 text-center text-sm text-muted-foreground">
          <Link
            href="/agents"
            className="block underline-offset-4 hover:underline"
          >
            Not a partner yet? Apply
          </Link>
          <Link
            href="/login"
            className="block underline-offset-4 hover:underline"
          >
            Use a different workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
