import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Billing → /admin/hotels",
  robots: { index: false, follow: false },
};

export default function SuperAdminBillingRedirect() {
  redirect("/admin/hotels");
}
