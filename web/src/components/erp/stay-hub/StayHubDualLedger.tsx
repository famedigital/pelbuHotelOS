"use client";

import type {
  StayHubLedgerSummary,
  StayHubMoneyLine,
  StayHubMoneyPayload,
} from "@/app/actions/stay-hub";
import { setFolioLinesBillToByKind } from "@/app/actions/erp-folio-ops";
import { StayHubFolioLedgerTable } from "@/components/erp/stay-hub/StayHubFolioLedgerTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

type Stream = "agent" | "guest";

function streamTotal(lines: StayHubMoneyLine[], stream: Stream): number {
  return lines.reduce((sum, l) => {
    if ((l.status ?? "").toLowerCase() === "voided") return sum;
    const st = (l.source_type ?? "").toLowerCase();
    const billTo = (l.bill_to ?? "guest") as Stream;
    if (st === "payment" || st === "deposit") {
      // Payments settle guest incidentals by default
      return stream === "guest" ? sum + Number(l.total_btn ?? 0) : sum;
    }
    if (billTo !== stream) return sum;
    return sum + Number(l.total_btn ?? 0);
  }, 0);
}

/**
 * Dual-stream folio: Tab A agent/company voucher vs Tab B guest incidentals.
 * Ledger rows stay opaque high-contrast (no blur on cells).
 */
export function StayHubDualLedger({
  money,
  summary,
  onChanged,
  onOptimisticVoid,
}: {
  money: StayHubMoneyPayload;
  summary: StayHubLedgerSummary;
  onChanged: () => void;
  onOptimisticVoid?: (lineId: string) => void;
}) {
  const [stream, setStream] = useState<Stream>(
    money.collectParty === "agent" ? "agent" : "guest",
  );
  const [pending, startTransition] = useTransition();

  const agentLines = useMemo(
    () =>
      money.lines.filter((l) => {
        const st = (l.source_type ?? "").toLowerCase();
        if (st === "payment" || st === "deposit") return false;
        return (l.bill_to ?? "guest") === "agent";
      }),
    [money.lines],
  );

  const guestLines = useMemo(
    () =>
      money.lines.filter((l) => {
        const st = (l.source_type ?? "").toLowerCase();
        if (st === "payment" || st === "deposit") return true;
        return (l.bill_to ?? "guest") !== "agent";
      }),
    [money.lines],
  );

  const agentDue = streamTotal(money.lines, "agent");
  const guestDue = money.guestVisibleBalanceBtn ?? streamTotal(money.lines, "guest");

  function transfer(mode: string) {
    if (!money.folioId) {
      toast.error("Open a folio before splitting streams.");
      return;
    }
    const fd = new FormData();
    fd.set("folio_id", money.folioId);
    fd.set("mode", mode);
    startTransition(async () => {
      const res = await setFolioLinesBillToByKind(
        { ok: false },
        fd,
      );
      if (res.ok) {
        toast.success(res.message ?? "Stream updated");
        onChanged();
      } else {
        toast.error(res.error ?? "Could not split bill");
      }
    });
  }

  const activeLines = stream === "agent" ? agentLines : guestLines;
  const activeDue = stream === "agent" ? agentDue : guestDue;

  return (
    <div className="space-y-3">
      <Tabs
        value={stream}
        onValueChange={(v) => setStream(v as Stream)}
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/30 p-1">
          <TabsTrigger
            value="agent"
            className={cn(
              "flex flex-col items-start gap-0.5 px-3 py-2 data-[state=active]:bg-background",
            )}
          >
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Tab A · Agent / company
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {formatGuestBtn(agentDue)}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="guest"
            className={cn(
              "flex flex-col items-start gap-0.5 px-3 py-2 data-[state=active]:bg-background",
            )}
          >
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Tab B · Guest incidentals
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {formatGuestBtn(guestDue)}
            </span>
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap gap-1.5 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={pending || !money.agentId}
            onClick={() => transfer("room_agent")}
          >
            Room → Tab A
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={pending}
            onClick={() => transfer("fnb_guest")}
          >
            F&amp;B → Tab B
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={pending || !money.agentId}
            onClick={() => transfer("fnb_agent")}
          >
            F&amp;B → Tab A
          </Button>
        </div>

        <TabsContent value="agent" className="mt-2">
          <div className="rounded-md border border-border/80 bg-card">
            <StayHubFolioLedgerTable
              lines={activeLines}
              summary={summary}
              siblingFolios={money.siblingFolios}
              empty="No agent / company lines yet. Move room package here for TCB voucher."
              onVoided={onChanged}
              onOptimisticVoid={onOptimisticVoid}
              dueBtn={activeDue}
              nightlyBaseBtn={money.agreedNightlyRateBtn}
              collectParty="agent"
            />
          </div>
        </TabsContent>
        <TabsContent value="guest" className="mt-2">
          <div className="rounded-md border border-border/80 bg-card">
            <StayHubFolioLedgerTable
              lines={activeLines}
              summary={summary}
              siblingFolios={money.siblingFolios}
              empty="No guest incidentals yet. POS, laundry, and minibar post here."
              onVoided={onChanged}
              onOptimisticVoid={onOptimisticVoid}
              dueBtn={activeDue}
              nightlyBaseBtn={money.agreedNightlyRateBtn}
              collectParty="guest"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
