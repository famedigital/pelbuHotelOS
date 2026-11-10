import { Metadata } from "next";
import { SixteenReportStudio } from "@/components/reports/SixteenReportStudio";

export const metadata: Metadata = {
  title: "16-Report Print Studio · Hotel OS Bhutan v2",
  description: "Official DRC Form BST-3, Daily Night Audit, and B2B Agent Statements.",
  robots: { index: false, follow: false },
};

export default function ErpReportsStudioPage() {
  return <SixteenReportStudio />;
}
