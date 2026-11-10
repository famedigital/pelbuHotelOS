import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Unpaid bills",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** @deprecated Prefer `/erp/bills?tab=owes` */
export default async function UnpaidBillsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { filter } = await searchParams;
  const qs = new URLSearchParams({ tab: "owes" });
  if (filter === "agents" || filter === "guests") qs.set("filter", filter);
  redirect(`/erp/bills?${qs.toString()}`);
}
