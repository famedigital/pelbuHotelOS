import { getAgentSession } from "@/lib/agent-auth";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { getStaffSession } from "@/lib/staff-auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login",
  description: "Innora login — desk, staff, and other workspaces.",
  robots: { index: false, follow: false },
};

/** Hotel path is /erp/login (eZee-style). This hub redirects. */
export default async function LoginHubPage() {
  if (await isDeskAuthenticated()) redirect("/erp");
  const staff = await getStaffSession();
  if (staff) redirect(staff.canAccessDesk ? "/erp" : "/staff");
  if (await getAgentSession()) redirect("/agents/app");
  redirect("/erp/login");
}
