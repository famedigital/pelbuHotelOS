"use client";

import type { AgentDocumentRow } from "@/app/actions/erp-agents";
import { AgentDetailPanel } from "@/components/erp/AgentDetailPanel";
import type { DeskAgentRow } from "@/components/erp/AgentDeskCard";

/** Account writes on the partner page — status, credit, documents. */
export function AgentDossierOpsPanel({
  agent,
  documents,
}: {
  agent: DeskAgentRow;
  documents: AgentDocumentRow[];
}) {
  return (
    <AgentDetailPanel
      agent={agent}
      documents={documents}
      compact
      hideCockpitLink
    />
  );
}
