import { AgentAppShell } from "@/components/erp/AgentAppShell";
import { getAgentSession } from "@/lib/agent-auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent app",
  robots: { index: false, follow: false },
  manifest: "/work.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Innora Partner",
  },
};

export default async function AgentAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAgentSession();
  if (!session) redirect("/agents/login");

  const h = await headers();
  const pathname =
    h.get("x-pathname") ||
    h.get("x-invoke-path") ||
    h.get("next-url") ||
    "";
  // Fallback: allow select-property without active hotel via URL check in middleware-less apps.
  // Next may not always expose pathname on headers — pages that need property use requireAgentPropertySession.

  const activeLink = session.links.find(
    (l) => l.propertyId === session.activePropertyId,
  );

  return (
    <AgentAppShell
      companyName={session.companyName}
      links={session.links.map((l) => ({
        propertyId: l.propertyId,
        propertyName: l.propertyName,
      }))}
      activePropertyId={session.activePropertyId}
      activePropertyName={activeLink?.propertyName ?? null}
    >
      {children}
    </AgentAppShell>
  );
}
