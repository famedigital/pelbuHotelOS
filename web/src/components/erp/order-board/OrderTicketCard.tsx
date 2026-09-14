"use client";

import { updateOrderKotStatus } from "@/app/actions/erp-pos";
import {
  elapsedMinutes,
  nextKotAdvance,
  summarizeItems,
  type OrderTicket,
} from "@/components/erp/order-board/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBtn } from "@/lib/pricing";
import { CheckIcon, ClockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function OrderTicketCard({
  ticket,
  onOpen,
}: {
  ticket: OrderTicket;
  onOpen: () => void;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const minutes = elapsedMinutes(ticket.createdAt, now);
  const slow = minutes >= 12;
  const advance = nextKotAdvance(ticket.kotStatus);
  const isOnline = ticket.orderSource === "public";
  const needsConfirm = isOnline && !ticket.confirmedAt;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  function handleAdvance(event: React.MouseEvent) {
    event.stopPropagation();
    if (!advance) return;
    const fd = new FormData();
    fd.set("order_id", ticket.id);
    fd.set("kot_status", advance.status);
    startTransition(async () => {
      await updateOrderKotStatus(fd);
      router.refresh();
    });
  }

  return (
    <article
      className={`rounded-lg border p-2.5 text-xs transition-colors ${
        ticket.kotStatus === "ready"
          ? "border-gold/50 bg-gold/5"
          : slow
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-card"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
        aria-label={`Open details for ${ticket.customerName}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-semibold text-foreground">
                {ticket.customerName || "Walk-in"}
              </p>
              {isOnline ? (
                <Badge
                  variant="outline"
                  className="h-5 border-gold/40 bg-gold/10 px-1.5 text-[9px] uppercase text-gold"
                >
                  Online
                </Badge>
              ) : null}
              {needsConfirm ? (
                <Badge variant="destructive" className="h-5 px-1.5 text-[9px]">
                  Confirm
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {summarizeItems(ticket.items)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {ticket.outlet}
              {ticket.deliveryType === "taxi"
                ? ` · taxi · ${ticket.deliveryArea ?? "Thimphu"}`
                : " · pickup"}
              {" · "}
              <span className={slow ? "font-semibold text-destructive" : ""}>
                {minutes}m
              </span>
            </p>
          </div>
          <p className="shrink-0 tabular-nums font-medium text-foreground">
            {formatBtn(ticket.totalBtn)}
          </p>
        </div>
      </button>

      {advance ? (
        <Button
          type="button"
          size="sm"
          variant={ticket.kotStatus === "ready" ? "citrus" : "default"}
          className="mt-2 h-8 w-full gap-1.5 text-[11px]"
          disabled={pending}
          onClick={handleAdvance}
        >
          {advance.status === "preparing" ? (
            <ClockIcon className="size-3.5" />
          ) : (
            <CheckIcon className="size-3.5" />
          )}
          {pending ? "Updating…" : advance.label}
        </Button>
      ) : null}
    </article>
  );
}
