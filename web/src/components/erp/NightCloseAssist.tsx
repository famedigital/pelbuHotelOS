"use client";

import { AiAssistPanel } from "@/components/erp/AiAssistPanel";
import {
  parseAssistDraft,
  parseNightCloseDraft,
} from "@/lib/ai/assist-draft-schemas";
import { toast } from "sonner";

/** Night close blockers draft — Run audit stays human. */
export function NightCloseAssist({ propertyId }: { propertyId: string }) {
  return (
    <AiAssistPanel
      propertyId={propertyId}
      mode="night_close"
      compact
      title="Night close — what to check"
      onApplyDraft={(raw) => {
        const parsed = parseAssistDraft(parseNightCloseDraft, raw);
        if (!parsed.ok) {
          toast.error(parsed.error);
          return;
        }
        toast.message(
          parsed.data.readyToRun ? "Looks clear to run" : "Fix blockers first",
          {
            description:
              parsed.data.plainSummary ||
              parsed.data.blockers?.join(" · ") ||
              "Review list above — then Run audit yourself",
            duration: 14_000,
          },
        );
      }}
    />
  );
}
