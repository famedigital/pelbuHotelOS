"use client";

import { AiAssistPanel } from "@/components/erp/AiAssistPanel";
import { parseAssistDraft, parseStayDraft } from "@/lib/ai/assist-draft-schemas";
import { toast } from "sonner";

export const STAY_DRAFT_STORAGE_KEY = "hotel_os_stay_draft_v1";

/**
 * StayView paste-to-stay: Confirm stores draft for New reservation / Hub prefill.
 */
export function StayViewAssistStrip({ propertyId }: { propertyId: string }) {
  return (
    <div className="mb-4">
      <AiAssistPanel
        propertyId={propertyId}
        mode="paste_to_stay"
        compact
        title="Paste agent message → stay draft"
        onApplyDraft={(raw) => {
          const parsed = parseAssistDraft(parseStayDraft, raw);
          if (!parsed.ok) {
            toast.error(parsed.error);
            return;
          }
          try {
            sessionStorage.setItem(
              STAY_DRAFT_STORAGE_KEY,
              JSON.stringify(parsed.data),
            );
          } catch {
            /* ignore */
          }
          const d = parsed.data;
          const bits = [
            d.guestName,
            d.checkIn && d.checkOut
              ? `${d.checkIn} → ${d.checkOut}`
              : d.checkIn,
            d.rooms != null ? `${d.rooms} room(s)` : null,
            d.mealPlan,
            d.nightlyRateBtn != null ? `Nu ${d.nightlyRateBtn}` : null,
            d.agentName,
          ].filter(Boolean);
          toast.success("Draft confirmed — open New reservation / Hub", {
            description:
              d.summary || bits.join(" · ") || "Fields saved for prefill.",
            duration: 12_000,
          });
        }}
      />
    </div>
  );
}
