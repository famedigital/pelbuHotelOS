import { isDeskAuthenticated, requireTaxDesk } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export default async function RrcoLayout({ children }: { children: React.ReactNode }) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  try {
    await requireTaxDesk();
  } catch {
    redirect("/erp/finance");
  }
  return children;
}
