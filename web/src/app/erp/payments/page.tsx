import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Payments",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** @deprecated Prefer `/erp/bills?tab=payments` */
export default async function PaymentsListRedirect() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  redirect("/erp/bills?tab=payments");
}
