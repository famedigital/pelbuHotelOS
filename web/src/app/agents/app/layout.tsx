import { AgentAppShell } from "@/components/erp/AgentAppShell";
import { getAgentSession } from "@/lib/agent-auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent app | Pelbu Suites",
  robots: { index: false, follow: false },
  manifest: "/work.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pelbu Partner",
  },
};

export default async function AgentAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAgentSession();
  if (!session) redirect("/agents/login");

  return (
    <AgentAppShell companyName={session.companyName}>{children}</AgentAppShell>
  );
}
