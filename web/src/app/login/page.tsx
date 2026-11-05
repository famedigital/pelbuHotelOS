import { getAgentSession } from "@/lib/agent-auth";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { getStaffSession } from "@/lib/staff-auth";
import { SITE_NAME } from "@/lib/site";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnifiedLoginHub } from "@/components/auth/UnifiedLoginHub";

export const metadata: Metadata = {
  title: `Unified Sign In · ${SITE_NAME}`,
  description: "Select hotel front desk, restaurant till POS, travel agent portal, or staff HR.",
  robots: { index: false, follow: false },
};

export default async function LoginHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ switch?: string; role?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const isSwitchMode = params.switch === "1";

  const isDesk = await isDeskAuthenticated();
  const staff = await getStaffSession();
  const agent = await getAgentSession();

  // If a role is requested directly via query param, jump straight to it
  if (params.role === "desk") redirect("/erp/login");
  if (params.role === "pos") redirect("/erp/pos/login");
  if (params.role === "agent") redirect("/agents/login");
  if (params.role === "staff") redirect("/staff/login");
  if (params.role === "admin") redirect("/admin/login");

  // If already authenticated and not in switch mode, allow resuming or redirect
  // If user explicitly asked to switch, show the Hub with the active session banner
  if (!isSwitchMode) {
    // If only one session exists and no explicit switch intent, seamless redirect can still happen,
    // but presenting the unified hub gives instant flexibility. Let's make it intuitive:
    // If you're on desk, redirect to /erp only if no query params at all.
    // However, if the user explicitly typed /login, showing the Hub with "Resume Workspace" is 10x better UX!
  }

  const activeSessionSummary = {
    isDesk,
    staffName: staff?.fullName ?? null,
    department: staff?.department ?? null,
    canAccessDesk: staff?.canAccessDesk ?? false,
    agentName: agent?.companyName ?? null,
    agentCode: agent?.loginCode ?? null,
  };

  return (
    <UnifiedLoginHub
      activeSession={activeSessionSummary}
      isSwitchMode={isSwitchMode}
    />
  );
}
