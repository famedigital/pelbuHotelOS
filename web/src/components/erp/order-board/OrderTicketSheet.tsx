"use client";

import {
  confirmPublicOrderAction,
  postOrderToBookingFolio,
  updateOrderKotStatus,
} from "@/app/actions/erp-pos";
import {
  elapsedMinutes,
  type OrderBoardBooking,
  type OrderTicket,
} from "@/components/erp/order-board/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { KOT_FLOW, KOT_LABEL } from "@/lib/kot";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useEffect, useState } from "react";

export function OrderTicketSheet({
  ticket,
  openBookings,
  open,
  onOpenChange,
}: {
  ticket: OrderTicket | null;
  openBookings: OrderBoardBooking[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!ticket) return null;

  const minutes = elapsedMinutes(ticket.createdAt, now);
  const isOnline = ticket.orderSource === "public";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {ticket.customerName || "Walk-in"}
            {isOnline ? (
              <Badge
                variant="outline"
                className="border-gold/40 bg-gold/10 text-gold"
              >
                Online
              </Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {ticket.outlet}
            {ticket.deliveryType === "taxi"
              ? ` · taxi · ${ticket.deliveryArea ?? "Thimphu"}`
              : " · pickup"}
            {" · "}
            {minutes}m · {formatBtn(ticket.totalBtn)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Items
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {ticket.items.length ? (
                ticket.items.map((item, index) => (
                  <li
                    key={`${item.name}-${index}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span>{item.name}</span>
                    <span className="tabular-nums font-semibold">{item.qty}×</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">Items pending</li>
              )}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Kitchen stage
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {KOT_FLOW.map((status) => (
                <form key={status} action={updateOrderKotStatus}>
                  <input type="hidden" name="order_id" value={ticket.id} />
                  <input type="hidden" name="kot_status" value={status} />
                  <Button
                    type="submit"
                    variant={ticket.kotStatus === status ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                  >
                    {KOT_LABEL[status]}
                  </Button>
                </form>
              ))}
            </div>
          </section>

          {isOnline ? (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Online order
              </h3>
              {!ticket.confirmedAt ? (
                <form action={confirmPublicOrderAction}>
                  <input type="hidden" name="order_id" value={ticket.id} />
                  <Button type="submit" variant="citrus" className="w-full">
                    Confirm order
                  </Button>
                </form>
              ) : !ticket.paymentRecordedAt ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Confirmed — awaiting payment.
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/erp/orders/${ticket.id}/slip`}>
                      Open slip · take payment
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Paid · journal {ticket.paymentJournalNo}
                </p>
              )}
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Charge to room
            </h3>
            {!ticket.postedToFolioAt && openBookings.length > 0 ? (
              <form
                action={postOrderToBookingFolio}
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="order_id" value={ticket.id} />
                <select
                  name="booking_id"
                  defaultValue=""
                  required
                  className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="" disabled>
                    Select in-house guest
                  </option>
                  {openBookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.contactName} · {booking.checkIn}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Posts full ticket to guest folio and marks ticket settled.
                  Guest pays at checkout. Tax invoice issues from the folio.
                </p>
                <Button type="submit" variant="citrus">
                  Charge to room
                </Button>
              </form>
            ) : ticket.postedToFolioAt ? (
              <p className="text-sm text-muted-foreground">
                On room
                {ticket.folioId ? (
                  <>
                    {" · "}
                    <Link
                      href={`/erp/folios/${ticket.folioId}`}
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      open folio
                    </Link>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No in-house booking available to charge.
              </p>
            )}
          </section>

          <p className="font-mono text-[10px] text-muted-foreground">
            {ticket.id}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
