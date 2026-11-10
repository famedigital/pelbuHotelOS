"use client";

import { AiAssistPanel } from "@/components/erp/AiAssistPanel";
import {
  parseAssistDraft,
  parsePosTicketDraft,
} from "@/lib/ai/assist-draft-schemas";
import { toast } from "sonner";

export type PosAssistLine = { name: string; qty: number; notes?: string };

/**
 * POS Assist — Confirm calls onApplyLines with matched draft lines.
 */
export function PosAssistStrip({
  propertyId,
  menuHints,
  onApplyLines,
}: {
  propertyId: string;
  menuHints?: string[];
  onApplyLines?: (lines: PosAssistLine[]) => void;
}) {
  return (
    <AiAssistPanel
      propertyId={propertyId}
      mode="pos_ticket"
      compact
      title="Paste order → ticket draft"
      menuHints={menuHints}
      onApplyDraft={(raw) => {
        const parsed = parseAssistDraft(parsePosTicketDraft, raw);
        if (!parsed.ok) {
          toast.error(parsed.error);
          return;
        }
        const lines: PosAssistLine[] = (parsed.data.lines ?? []).map((l) => ({
          name: l.name,
          qty: Math.max(1, Math.min(40, Number(l.qty) || 1)),
          notes: l.notes ?? undefined,
        }));
        if (lines.length === 0) {
          toast.message("No lines in draft");
          return;
        }
        if (onApplyLines) {
          onApplyLines(lines);
        } else {
          toast.success("Draft confirmed — add lines on the menu", {
            description: lines.map((l) => `${l.qty}× ${l.name}`).join(", "),
          });
        }
      }}
    />
  );
}
