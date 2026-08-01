"use client";

import type { AgentDocumentRow } from "@/app/actions/erp-agents";
import { AgentDetailPanel } from "@/components/erp/AgentDetailPanel";
import { Card } from "@/components/ui/card";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

export type DeskAgentRow = {
  id: string;
  company_name: string;
  market: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  license_url: string | null;
  notes: string | null;
  status: string;
  rate_tier: string;
  credit_limit: number;
  credit_used: number;
  wants_mou: boolean;
  approved_at: string | null;
  created_at: string;
  portal_token: string | null;
};

export function AgentDeskCard({
  agent,
  documents,
}: {
  agent: DeskAgentRow;
  documents: AgentDocumentRow[];
}) {
  const available = Math.max(0, agent.credit_limit - agent.credit_used);
  const statusTone =
    agent.status === "approved"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : agent.status === "rejected"
        ? "border-destructive/40 bg-destructive/5 text-destructive"
        : agent.status === "demo"
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border text-muted-foreground";

  return (
    <Card className="erp gap-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/erp/agents/${agent.id}`}
              className="text-base font-medium text-foreground underline-offset-4 hover:underline"
            >
              {agent.company_name}
            </Link>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusTone}`}
            >
              {agent.status}
            </span>
            {agent.wants_mou ? (
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                MoU
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
            {agent.market}
          </p>
          <p className="mt-2 text-sm text-foreground/80">
            {[agent.contact_name, agent.contact_phone].filter(Boolean).join(" · ") ||
              "No contact on file"}
          </p>
        </div>
        <div className="text-right text-sm text-foreground">
          <p>
            Used {formatBtn(agent.credit_used)} / {formatBtn(agent.credit_limit)}
          </p>
          <p className="mt-0.5 text-muted-foreground">Available {formatBtn(available)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tier: {agent.rate_tier}</p>
        </div>
      </div>

      <div className="mt-5 border-t pt-5">
        <AgentDetailPanel agent={agent} documents={documents} />
      </div>
    </Card>
  );
}
