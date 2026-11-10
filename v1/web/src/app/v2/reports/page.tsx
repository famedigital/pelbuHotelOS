import { Metadata } from "next";
import { V2ReportStudio } from "@/components/v2/V2ReportStudio";

export const metadata: Metadata = {
  title: "16-Report Print Studio · Hotel OS v2",
  description: "Official DRC Form BST-3, Daily Night Audit, and B2B Agent Statements.",
  robots: { index: false, follow: false },
};

export default function V2ReportsPage() {
  return <V2ReportStudio />;
}
