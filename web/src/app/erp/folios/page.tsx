import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Open bills",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** @deprecated Prefer `/erp/bills?tab=stay` — folio detail stays at `/erp/folios/[id]` */
export default async function FoliosListRedirect() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  redirect("/erp/bills?tab=stay");
}
