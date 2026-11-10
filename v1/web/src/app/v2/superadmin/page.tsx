import { Metadata } from "next";
import { SuperAdminBillingDesk } from "@/components/superadmin/SuperAdminBillingDesk";

export const metadata: Metadata = {
  title: "SuperAdmin Revenue & License Control · Hotel OS v2",
  description: "Commercial multi-tenant billing, dynamic RMA Bhutan QR, and 48-hour emergency pass generator.",
  robots: { index: false, follow: false },
};

export default function V2SuperAdminPage() {
  return <SuperAdminBillingDesk />;
}
