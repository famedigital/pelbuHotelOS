"use client";

import { AiAssistPanel } from "@/components/erp/AiAssistPanel";
import {
  parseAssistDraft,
  parseExplainDueDraft,
} from "@/lib/ai/assist-draft-schemas";
import { toast } from "sonner";

/** Explain partner AR / credit — Confirm only; Collect stays on Hub / Money. */
export function AgentDueAssist({
  propertyId,
  agentId,
}: {
  propertyId: string;
  agentId: string;
}) {
  return (
    <AiAssistPanel
      propertyId={propertyId}
      agentId={agentId}
      mode="explain_agent_due"
      compact
      title="Explain partner due"
      onApplyDraft={(raw) => {
        const parsed = parseAssistDraft(parseExplainDueDraft, raw);
        if (!parsed.ok) {
          toast.error(parsed.error);
          return;
        }
        const d = parsed.data;
        toast.success("Due explanation ready — Collect via Hub or Money", {
          description:
            d.plainExplanation ||
            (d.dueBtn != null ? `Due Nu ${d.dueBtn}` : undefined),
          duration: 14_000,
        });
      }}
    />
  );
}
