import { Metadata } from "next";
import { V2NightAuditPage } from "@/components/v2/V2NightAuditPage";

export const metadata: Metadata = {
  title: "Night audit · Hotel OS v2",
  description: "Preview and run POST /v1/night-audit/run.",
  robots: { index: false, follow: false },
};

export default function V2NightAuditPageRoute() {
  return <V2NightAuditPage />;
}
