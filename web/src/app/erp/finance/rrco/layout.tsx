import { isDeskAuthenticated, requireDeskRole } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

/** Read the tax pack. Filing and edits stay on owner and accountant. */
const RRCO_VIEW_ROLES = ["owner", "accountant", "gm"] as const;

export default async function RrcoLayout({ children }: { children: React.ReactNode }) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  try {
    await requireDeskRole(RRCO_VIEW_ROLES);
  } catch {
    redirect("/erp/finance");
  }
  return children;
}
