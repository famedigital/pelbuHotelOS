"use client";

import { AiAssistPanel } from "@/components/erp/AiAssistPanel";
import {
  parseAssistDraft,
  parseAgentRateSheetDraft,
} from "@/lib/ai/assist-draft-schemas";
import { toast } from "sonner";

/** Propose Agents-tier % — Save sheet remains human. */
export function AgentRateAssist({ propertyId }: { propertyId: string }) {
  return (
    <AiAssistPanel
      propertyId={propertyId}
      mode="rate_sheet"
      compact
      title="Propose Agents rates"
      placeholder="e.g. 90% of Public for all seasons…"
      onApplyDraft={(raw) => {
        const parsed = parseAssistDraft(parseAgentRateSheetDraft, raw);
        if (!parsed.ok) {
          toast.error(parsed.error);
          return;
        }
        const pct = parsed.data.agentsPctOfPublic;
        toast.success("Rate proposal ready — apply in the sheet and Save", {
          description:
            parsed.data.summary ||
            (pct != null ? `${pct}% of Public` : undefined),
          duration: 14_000,
        });
      }}
    />
  );
}
