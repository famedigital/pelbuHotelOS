import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "GST returns | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Desk tab → single GST home under Finance. */
export default async function GstReturnsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  redirect("/erp/finance/gst");
}
