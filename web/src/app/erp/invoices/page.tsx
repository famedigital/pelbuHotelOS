import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Invoices",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** @deprecated Prefer `/erp/bills?tab=invoices` — detail routes stay at `/erp/invoices/[id]` */
export default async function InvoicesListRedirect() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  redirect("/erp/bills?tab=invoices");
}
