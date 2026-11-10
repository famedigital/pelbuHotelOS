"use client";

import { OrderTicketCard } from "@/components/erp/order-board/OrderTicketCard";
import { OrderTicketSheet } from "@/components/erp/order-board/OrderTicketSheet";
import {
  ORDER_BOARD_COLUMNS,
  type OrderBoardBooking,
  type OrderBoardColumnId,
  type OrderTicket,
} from "@/components/erp/order-board/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KOT_LABEL } from "@/lib/kot";
import { MonitorIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export function OrderBoard({
  tickets,
  openBookings,
}: {
  tickets: OrderTicket[];
  openBookings: OrderBoardBooking[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const buckets = useMemo(() => {
    const next: Record<OrderBoardColumnId, OrderTicket[]> = {
      new: [],
      preparing: [],
      ready: [],
    };
    for (const ticket of tickets) {
      if (ticket.kotStatus === "new") next.new.push(ticket);
      else if (ticket.kotStatus === "preparing") next.preparing.push(ticket);
      else if (ticket.kotStatus === "ready") next.ready.push(ticket);
    }
    return next;
  }, [tickets]);

  const selected =
    tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const defaultTab =
    (ORDER_BOARD_COLUMNS.find((column) => buckets[column].length > 0) ??
      "new") as OrderBoardColumnId;

  return (
    <div className="space-y-3">
      {/* Mobile / tablet: one stage at a time */}
      <div className="xl:hidden">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid h-auto w-full grid-cols-3">
            {ORDER_BOARD_COLUMNS.map((column) => (
              <TabsTrigger key={column} value={column} className="gap-1.5 py-2">
                {KOT_LABEL[column]}
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                  {buckets[column].length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {ORDER_BOARD_COLUMNS.map((column) => (
            <TabsContent key={column} value={column} className="mt-3">
              <TicketList
                tickets={buckets[column]}
                emptyLabel={`No ${KOT_LABEL[column].toLowerCase()} tickets.`}
                onOpen={setSelectedId}
                className="max-h-[22rem] overflow-y-auto pr-1"
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Desktop: three capped scroll columns */}
      <div className="hidden gap-3 xl:grid xl:grid-cols-3">
        {ORDER_BOARD_COLUMNS.map((column) => (
          <section
            key={column}
            className="rounded-lg border bg-muted/30 p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {KOT_LABEL[column]}
              </h3>
              <Badge variant="outline">{buckets[column].length}</Badge>
            </div>
            <TicketList
              tickets={buckets[column]}
              emptyLabel="No tickets."
              onOpen={setSelectedId}
              className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1"
            />
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          {tickets.length} open ticket{tickets.length === 1 ? "" : "s"}
        </p>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
          <Link href="/erp/kds">
            <MonitorIcon className="size-3.5" />
            Full kitchen
          </Link>
        </Button>
      </div>

      <OrderTicketSheet
        ticket={selected}
        openBookings={openBookings}
        open={selected != null}
        onOpenChange={(next) => {
          if (!next) setSelectedId(null);
        }}
      />
    </div>
  );
}

function TicketList({
  tickets,
  emptyLabel,
  onOpen,
  className,
}: {
  tickets: OrderTicket[];
  emptyLabel: string;
  onOpen: (id: string) => void;
  className?: string;
}) {
  if (!tickets.length) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className={className ?? "space-y-2"}>
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <OrderTicketCard ticket={ticket} onOpen={() => onOpen(ticket.id)} />
        </li>
      ))}
    </ul>
  );
}
