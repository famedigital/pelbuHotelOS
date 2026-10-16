"use client";

import type { AgentDocumentRow } from "@/app/actions/erp-agents";
import { AgentDetailPanel } from "@/components/erp/AgentDetailPanel";
import type { DeskAgentRow } from "@/components/erp/AgentDeskCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Desk writes on dossier — approve, credit, docs (same panel as list accordion). */
export function AgentDossierOpsPanel({
  agent,
  documents,
}: {
  agent: DeskAgentRow;
  documents: AgentDocumentRow[];
}) {
  return (
    <Card id="agent-desk-ops" className="scroll-mt-20 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Partner desk</CardTitle>
        <CardDescription>
          Approve · credit · room cap · documents — Confirm every money write
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AgentDetailPanel
          agent={agent}
          documents={documents}
          compact
          hideCockpitLink
        />
      </CardContent>
    </Card>
  );
}
