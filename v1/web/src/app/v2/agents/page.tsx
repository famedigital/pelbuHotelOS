import { Metadata } from "next";
import { V2AgentsWorkspace } from "@/components/v2/V2AgentsWorkspace";

export const metadata: Metadata = {
  title: "Agents · Hotel OS v2",
  description: "B2B agents, credit, and ledger from GET /v1/agents.",
  robots: { index: false, follow: false },
};

export default function V2AgentsPage() {
  return <V2AgentsWorkspace />;
}
