"use client";

import {
  confirmPublicOrder,
  parkOrder,
  postOrderToBookingFolio,
  recallOrder,
  type ConfirmOrderState,
  unparkOrder,
  updateOrderKotStatus,
  type PosActionState,
} from "@/app/actions/erp-pos";
import { DeskLiveRefresh } from "@/components/erp/DeskLiveRefresh";
import { RecordOrderPaymentForm } from "@/components/erp/RecordOrderPaymentForm";
import type { PosBookingOption } from "@/components/erp/pos/types";
import { orderRef } from "@/lib/order-ref";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useActionToast } from "@/hooks/use-action-toast";
import type { DiningTable, OpenPosTicket } from "@/lib/pos";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useTransition,
  useState,
} from "react";

const initialPark: PosActionState = { ok: false };
const initialUnpark: PosActionState = { ok: false };
const initialRecall: PosActionState = { ok: false };
const initialConfirm: ConfirmOrderState = { ok: false };

const TENDER_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank",
  card: "Card",
  agent_credit: "Agent credit",
  bank_qr: "Bank QR",
  pay_bt: "Pay.bt",
  deposit: "Deposit",
  room_charge: "Room charge",
};

function tenderLabel(method: string): string {
  return TENDER_LABELS[method] ?? method.replace(/_/g, " ");
}

function ticketTableLabel(
  ticket: OpenPosTicket,
  tables: DiningTable[],
): string | null {
  if (!ticket.table_id) return null;
  const t = tables.find((x) => x.id === ticket.table_id);
  return t?.name ?? "Table";
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-BT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paidAmount(ticket: OpenPosTicket): number {
  if (ticket.amount_tendered_btn > 0) return ticket.amount_tendered_btn;
  if (ticket.order_source === "public" && ticket.payment_recorded_at) {
    return ticket.total_btn;
  }
  if (ticket.settled_at) return ticket.total_btn;
  return 0;
}

function balanceAmount(ticket: OpenPosTicket): number {
  if (ticket.settled_at) return 0;
  return Math.max(
    0,
    Math.round((ticket.total_btn - paidAmount(ticket)) * 100) / 100,
  );
}

function PayBadge({ ticket }: { ticket: OpenPosTicket }) {
  const onRoom =
    Boolean(ticket.posted_to_folio_at) ||
    ticket.tenders.some((t) => t.method === "room_charge");
  if (onRoom) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        On room
      </Badge>
    );
  }
  if (ticket.settled_at) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        Settled
      </Badge>
    );
  }
  if (ticket.order_source === "public" && ticket.payment_recorded_at) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        Online paid
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-citrus/40 text-[10px] text-citrus"
    >
      Unpaid
    </Badge>
  );
}

function MoneyStrip({ ticket }: { ticket: OpenPosTicket }) {
  const paid = paidAmount(ticket);
  const balance = balanceAmount(ticket);
  const methods =
    ticket.tenders.length > 0
      ? ticket.tenders
          .map((t) => `${tenderLabel(t.method)} ${formatBtn(t.amount_btn)}`)
          .join(" · ")
      : ticket.order_source === "public" && ticket.payment_recorded_at
        ? `Journal ${ticket.payment_journal_no ?? "recorded"}`
        : null;

  return (
    <div className="mt-2 space-y-1 rounded-md border border-border/70 bg-muted/30 px-2.5 py-2 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">
          Total{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatBtn(ticket.total_btn)}
          </span>
        </span>
        <span className="text-muted-foreground">
          Paid{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatBtn(paid)}
          </span>
        </span>
        <span className="text-muted-foreground">
          Balance{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatBtn(balance)}
          </span>
        </span>
      </div>
      {methods ? <p className="text-muted-foreground">{methods}</p> : null}
      {ticket.folio_id ? (
        <Link
          href={`/erp/folios/${ticket.folio_id}`}
          className="inline-flex text-accent underline-offset-4 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open folio →
        </Link>
      ) : null}
    </div>
  );
}

const PREP_LABELS: Record<string, string> = {
  kitchen: "Kitchen",
  bar: "Bar",
  pastry: "Pastry",
  grill: "Grill",
  cold: "Cold",
};

/**
 * Group an order's lines by prep_station. Used so a single mixed ticket
 * (cafe + bar + pastry) renders as one Kitchen section, one Bar section,
 * one Pastry section — matching how stations actually pull work.
 */
function groupByPrepStation(
  items: {
    name_snapshot: string;
    qty: number;
    course_no: number;
    prep_station: string;
  }[],
): {
  station: string;
  label: string;
  lines: { qty: number; name: string; course_no: number }[];
}[] {
  const map = new Map<
    string,
    { qty: number; name: string; course_no: number }[]
  >();
  for (const item of items) {
    const station = item.prep_station || "kitchen";
    const list = map.get(station) ?? [];
    list.push({
      qty: item.qty,
      name: item.name_snapshot,
      course_no: item.course_no,
    });
    map.set(station, list);
  }
  const order = ["kitchen", "bar", "pastry", "grill", "cold"];
  return [...map.entries()]
    .map(([station, lines]) => ({
      station,
      label: PREP_LABELS[station] ?? station,
      lines,
    }))
    .sort(
      (a, b) =>
        (order.indexOf(a.station) === -1 ? 99 : order.indexOf(a.station)) -
        (order.indexOf(b.station) === -1 ? 99 : order.indexOf(b.station)),
    );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tickets: OpenPosTicket[];
  settledTickets?: OpenPosTicket[];
  bookings?: PosBookingOption[];
  tables: DiningTable[];
  onSettle: (orderId: string) => void;
  onVoid: (orderId: string) => void;
};

export function OpenTicketsDrawer({
  open,
  onOpenChange,
  tickets,
  settledTickets = [],
  bookings = [],
  tables,
  onSettle,
  onVoid,
}: Props) {
  const [parkState, parkAction, parkPending] = useActionState(
    parkOrder,
    initialPark,
  );
  const [unparkState, unparkAction, unparkPending] = useActionState(
    unparkOrder,
    initialUnpark,
  );
  const [recallState, recallAction, recallPending] = useActionState(
    recallOrder,
    initialRecall,
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmPublicOrder,
    initialConfirm,
  );
  const router = useRouter();
  const [kotError, setKotError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [postPending, startPostTransition] = useTransition();
  const [kotPending, startKotTransition] = useTransition();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lane, setLane] = useState<"open" | "closed">("open");

  function runKot(orderId: string, nextStatus: string) {
    setKotError(null);
    startKotTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("order_id", orderId);
        fd.set("kot_status", nextStatus);
        await updateOrderKotStatus(fd);
        startTransition(() => router.refresh());
      } catch (err) {
        setKotError(
          err instanceof Error ? err.message : "Could not update KOT.",
        );
      }
    });
  }

  function runPostToRoom(orderId: string, bookingId: string) {
    setPostError(null);
    startPostTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("order_id", orderId);
        fd.set("booking_id", bookingId);
        await postOrderToBookingFolio(fd);
        startTransition(() => router.refresh());
      } catch (err) {
        setPostError(
          err instanceof Error ? err.message : "Could not charge to room.",
        );
      }
    });
  }

  useActionToast(parkState, { successMessage: "Ticket parked" });
  useActionToast(unparkState, { successMessage: "Ticket unparked" });
  useActionToast(recallState, { successMessage: "Ticket recalled" });
  useActionToast(confirmState, {
    successMessage: "Order confirmed — open the slip and send it to the guest",
  });

  const openedSlipFor = useRef<string | null>(null);
  useEffect(() => {
    if (!confirmState.ok || !confirmState.orderId) return;
    if (openedSlipFor.current === confirmState.orderId) return;
    openedSlipFor.current = confirmState.orderId;
    router.push(`/erp/orders/${confirmState.orderId}/slip`);
  }, [confirmState, router]);

  const isOnline = (t: OpenPosTicket) => t.order_source === "public";
  const pendingConfirm = tickets.filter(
    (t) => isOnline(t) && !t.confirmed_at && !t.is_parked,
  );
  const awaitingPayment = tickets.filter(
    (t) =>
      isOnline(t) && t.confirmed_at && !t.payment_recorded_at && !t.is_parked,
  );
  const parked = tickets.filter((t) => t.is_parked);
  // Kitchen advanced past ready; still needs desk settle/void before shift close.
  const servedUnpaid = tickets.filter(
    (t) =>
      !t.is_parked &&
      t.kot_status === "served" &&
      !(isOnline(t) && (!t.confirmed_at || !t.payment_recorded_at)),
  );
  const active = tickets.filter(
    (t) =>
      !t.is_parked &&
      t.kot_status !== "served" &&
      !(isOnline(t) && (!t.confirmed_at || !t.payment_recorded_at)),
  );
  const busy =
    parkPending ||
    unparkPending ||
    recallPending ||
    kotPending ||
    confirmPending ||
    postPending;

  const detailFromOpen = detailId
    ? (tickets.find((t) => t.id === detailId) ?? null)
    : null;
  const detailFromClosed = detailId
    ? (settledTickets.find((t) => t.id === detailId) ?? null)
    : null;
  const detail = detailFromOpen ?? detailFromClosed;
  const detailIsClosed = Boolean(detailFromClosed && !detailFromOpen);

  function ticketActions(t: OpenPosTicket, closedLane = false) {
    const online = isOnline(t);
    if (closedLane || t.settled_at) {
      return (
        <div className="flex flex-wrap gap-1.5">
          <Button
            asChild
            type="button"
            variant="citrus"
            size="sm"
            className="h-9"
          >
            <Link href={`/erp/orders/${t.id}/receipt?print=1`}>
              Print receipt
            </Link>
          </Button>
          <Button
            asChild
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
          >
            <Link href={`/erp/orders/${t.id}/receipt`}>View</Link>
          </Button>
          {t.folio_id ? (
            <Button
              asChild
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
            >
              <Link href={`/erp/folios/${t.folio_id}`}>Open folio</Link>
            </Button>
          ) : null}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {!t.settled_at ? (
          <Button
            type="button"
            variant="citrus"
            size="sm"
            className="h-9"
            disabled={busy}
            onClick={() => onSettle(t.id)}
          >
            Settle
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={busy}
          onClick={() => onVoid(t.id)}
        >
          Void
        </Button>
        {online && !t.confirmed_at ? (
          <form action={confirmAction}>
            <input type="hidden" name="order_id" value={t.id} />
            <Button
              type="submit"
              variant="citrus"
              size="sm"
              className="h-9"
              disabled={busy}
            >
              Confirm · open slip
            </Button>
          </form>
        ) : null}
        {online && t.confirmed_at ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={busy}
            onClick={() => router.push(`/erp/orders/${t.id}/slip`)}
          >
            Open slip
          </Button>
        ) : null}
        <Button
          asChild
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
        >
          <Link href={`/erp/orders/${t.id}/slip`}>Print slip</Link>
        </Button>
        {t.is_parked ? (
          <form action={unparkAction}>
            <input type="hidden" name="order_id" value={t.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={busy}
            >
              Resume
            </Button>
          </form>
        ) : (
          <form action={parkAction}>
            <input type="hidden" name="order_id" value={t.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={busy}
            >
              Park
            </Button>
          </form>
        )}
        {t.kot_status === "new" || t.kot_status === "preparing" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={busy}
            onClick={() => runKot(t.id, "ready")}
          >
            Mark ready
          </Button>
        ) : null}
        {t.kot_status === "ready" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={busy}
            onClick={() => runKot(t.id, "served")}
          >
            Mark served
          </Button>
        ) : null}
        {t.kot_status === "ready" || t.kot_status === "served" ? (
          <form action={recallAction}>
            <input type="hidden" name="order_id" value={t.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={busy}
            >
              Recall
            </Button>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDetailId(null);
          setPostError(null);
          setLane("open");
        }
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="erp flex w-full flex-col gap-0 sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>
              {detail
                ? `Ticket ${orderRef(detail.id)}`
                : lane === "closed"
                  ? "Closed today"
                  : "Open tickets"}
            </SheetTitle>
            <DeskLiveRefresh label="Live" />
          </div>
          <SheetDescription>
            {detail
              ? "Full ticket — items, money, and every action for this order."
              : lane === "closed"
                ? "Settled tickets for today’s business date. Tax invoices issue from the guest folio."
                : "Tap a ticket to open it. Settle, charge to room, or void from here."}
          </SheetDescription>
          {!detail ? (
            <div className="flex gap-1 pt-1">
              <Button
                type="button"
                size="sm"
                variant={lane === "open" ? "default" : "outline"}
                className="h-8"
                onClick={() => setLane("open")}
              >
                Open · {tickets.length}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={lane === "closed" ? "default" : "outline"}
                className="h-8"
                onClick={() => setLane("closed")}
              >
                Closed today · {settledTickets.length}
              </Button>
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {kotError || postError ? (
            <p
              className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {postError ?? kotError}
            </p>
          ) : null}
          {detail ? (
            <TicketDetail
              ticket={detail}
              tables={tables}
              bookings={bookings}
              closedLane={detailIsClosed}
              postPending={busy}
              onBack={() => {
                setDetailId(null);
                setPostError(null);
              }}
              onPostToRoom={runPostToRoom}
              actions={ticketActions(detail, detailIsClosed)}
            />
          ) : lane === "closed" ? (
            settledTickets.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm font-medium text-foreground">
                  No closed tickets today
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Settled pay-now and charge-to-room tickets appear here. Tax
                  invoices (INV-YYYY-####) are listed under Money → Invoices
                  after you issue them from a folio.
                </p>
              </div>
            ) : (
              <TicketGroup
                title="Closed today"
                tickets={settledTickets}
                tables={tables}
                busy={busy}
                onSettle={onSettle}
                onVoid={onVoid}
                onOpen={setDetailId}
                closedLane
                actions={(t) => ticketActions(t, true)}
              />
            )
          ) : tickets.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-foreground">
                No open tickets
              </p>
              <p className="text-xs text-muted-foreground">
                New tickets and parked tickets will appear here. Check Closed
                today for settled bills.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingConfirm.length > 0 ? (
                <TicketGroup
                  title="Pending confirm"
                  tickets={pendingConfirm}
                  tables={tables}
                  busy={busy}
                  onSettle={onSettle}
                  onVoid={onVoid}
                  onOpen={setDetailId}
                  highlight
                  actions={(t) => (
                    <form action={confirmAction}>
                      <input type="hidden" name="order_id" value={t.id} />
                      <Button
                        type="submit"
                        variant="citrus"
                        size="sm"
                        className="h-9"
                        disabled={busy}
                      >
                        Confirm · open slip
                      </Button>
                    </form>
                  )}
                />
              ) : null}
              {awaitingPayment.length > 0 ? (
                <TicketGroup
                  title="Awaiting payment"
                  tickets={awaitingPayment}
                  tables={tables}
                  busy={busy}
                  onSettle={onSettle}
                  onVoid={onVoid}
                  onOpen={setDetailId}
                  highlight
                  footer={(t) => (
                    <div className="mt-2">
                      <RecordOrderPaymentForm orderId={t.id} compact />
                    </div>
                  )}
                  actions={() => null}
                />
              ) : null}
              {parked.length > 0 ? (
                <TicketGroup
                  title="Parked"
                  tickets={parked}
                  tables={tables}
                  busy={busy}
                  onSettle={onSettle}
                  onVoid={onVoid}
                  onOpen={setDetailId}
                  actions={(t) => (
                    <form action={unparkAction}>
                      <input type="hidden" name="order_id" value={t.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={busy}
                      >
                        Resume
                      </Button>
                    </form>
                  )}
                />
              ) : null}
              {servedUnpaid.length > 0 ? (
                <TicketGroup
                  title="Served — settle"
                  tickets={servedUnpaid}
                  tables={tables}
                  busy={busy}
                  onSettle={onSettle}
                  onVoid={onVoid}
                  onOpen={setDetailId}
                  highlight
                  actions={(t) => ticketActions(t, false)}
                />
              ) : null}
              <TicketGroup
                title="Live"
                tickets={active}
                tables={tables}
                busy={busy}
                onSettle={onSettle}
                onVoid={onVoid}
                onOpen={setDetailId}
                actions={(t) => (
                  <div className="flex flex-wrap gap-1.5">
                    <form action={parkAction}>
                      <input type="hidden" name="order_id" value={t.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={busy}
                      >
                        Park
                      </Button>
                    </form>
                    {t.kot_status === "new" || t.kot_status === "preparing" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={busy}
                        onClick={() => runKot(t.id, "ready")}
                      >
                        Mark ready
                      </Button>
                    ) : null}
                    {t.kot_status === "ready" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={busy}
                        onClick={() => runKot(t.id, "served")}
                      >
                        Mark served
                      </Button>
                    ) : null}
                    {t.kot_status === "ready" || t.kot_status === "served" ? (
                      <form action={recallAction}>
                        <input type="hidden" name="order_id" value={t.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          disabled={busy}
                        >
                          Recall
                        </Button>
                      </form>
                    ) : null}
                  </div>
                )}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TicketGroup({
  title,
  tickets,
  tables,
  busy,
  onSettle,
  onVoid,
  onOpen,
  actions,
  footer,
  highlight = false,
  closedLane = false,
}: {
  title: string;
  tickets: OpenPosTicket[];
  tables: DiningTable[];
  busy: boolean;
  onSettle: (orderId: string) => void;
  onVoid: (orderId: string) => void;
  onOpen: (orderId: string) => void;
  actions: (t: OpenPosTicket) => React.ReactNode;
  footer?: (t: OpenPosTicket) => React.ReactNode;
  highlight?: boolean;
  closedLane?: boolean;
}) {
  if (tickets.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {title} · {tickets.length}
      </p>
      <ul className="space-y-2">
        {tickets.map((t) => (
          <li
            key={t.id}
            className={`rounded-lg border p-3 ${
              highlight
                ? "border-gold/50 bg-gold/5 ring-1 ring-gold/20"
                : "border-border bg-card"
            }`}
          >
            <button
              type="button"
              onClick={() => onOpen(t.id)}
              aria-label={`Open ticket ${orderRef(t.id)}`}
              className="flex w-full items-start justify-between gap-2 rounded-md text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {t.customer_name || "Walk-in"}
                  </p>
                  {t.order_source === "public" ? (
                    <Badge variant="gold" className="text-[10px]">
                      Online
                    </Badge>
                  ) : null}
                  <PayBadge ticket={t} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-mono">{t.id.slice(0, 8)}</span>
                  {` · ${t.outlet}`}
                  {t.covers ? ` · ${t.covers} covers` : ""}
                  {ticketTableLabel(t, tables)
                    ? ` · ${ticketTableLabel(t, tables)}`
                    : ""}
                  {t.order_source === "public" && t.delivery_type === "taxi"
                    ? ` · taxi ${t.delivery_area ?? "Thimphu"}`
                    : t.order_source === "public" && t.delivery_type === "room"
                      ? ` · room ${t.delivery_area ?? ""}`
                      : t.order_source === "public"
                        ? " · pickup"
                        : ""}
                  {t.order_source !== "public"
                    ? ""
                    : !t.confirmed_at
                      ? " · pending confirm"
                      : !t.payment_recorded_at
                        ? ` · confirmed ${timeLabel(t.confirmed_at)} · unpaid`
                        : ` · paid ${t.payment_journal_no ?? ""}`.trimEnd()}
                  {` · ${timeLabel(t.settled_at ?? t.created_at)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatBtn(t.total_btn)}
                </p>
                {!closedLane ? (
                  <Badge
                    variant={t.kot_status === "ready" ? "gold" : "secondary"}
                    className="mt-1 capitalize"
                  >
                    {t.kot_status}
                  </Badge>
                ) : (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {t.tenders.map((x) => tenderLabel(x.method)).join(" · ") ||
                      "Settled"}
                  </p>
                )}
              </div>
            </button>

            <MoneyStrip ticket={t} />

            {t.order_items.length > 0
              ? (() => {
                  const groups = groupByPrepStation(t.order_items);
                  const mixed = groups.length > 1;
                  return (
                    <div className="mt-2 space-y-1.5">
                      {groups.map((g) => (
                        <div key={g.station} className="space-y-0.5">
                          {mixed ? (
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                              {g.label}
                            </p>
                          ) : null}
                          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                            {g.lines.slice(0, 4).map((i, idx) => (
                              <li key={idx}>
                                {i.qty}× {i.name}
                                {i.course_no > 1 ? ` · c${i.course_no}` : ""}
                              </li>
                            ))}
                            {g.lines.length > 4 ? (
                              <li className="italic">
                                + {g.lines.length - 4} more
                              </li>
                            ) : null}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })()
              : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {!closedLane && !t.settled_at ? (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="citrus"
                    size="sm"
                    className="h-9"
                    onClick={() => onSettle(t.id)}
                    disabled={busy}
                  >
                    Settle
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => onVoid(t.id)}
                    disabled={busy}
                  >
                    Void
                  </Button>
                </div>
              ) : (
                <div />
              )}
              {actions(t)}
            </div>
            {footer ? footer(t) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TicketDetail({
  ticket,
  tables,
  bookings,
  closedLane,
  postPending,
  onBack,
  onPostToRoom,
  actions,
}: {
  ticket: OpenPosTicket;
  tables: DiningTable[];
  bookings: PosBookingOption[];
  closedLane: boolean;
  postPending: boolean;
  onBack: () => void;
  onPostToRoom: (orderId: string, bookingId: string) => void;
  actions: React.ReactNode;
}) {
  const groups = groupByPrepStation(ticket.order_items);
  const online = ticket.order_source === "public";
  const awaitingPayment =
    online && Boolean(ticket.confirmed_at) && !ticket.payment_recorded_at;
  const table = ticketTableLabel(ticket, tables);
  const canChargeRoom =
    !closedLane &&
    !ticket.settled_at &&
    !ticket.posted_to_folio_at &&
    bookings.length > 0;
  const [bookingId, setBookingId] = useState(ticket.booking_id ?? "");

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 -ml-2 px-2 text-muted-foreground"
        onClick={onBack}
      >
        ← All tickets
      </Button>

      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-medium text-foreground">
                {ticket.customer_name || "Walk-in"}
              </p>
              {online ? (
                <Badge variant="gold" className="text-[10px]">
                  Online
                </Badge>
              ) : null}
              {ticket.is_parked ? (
                <Badge variant="secondary" className="text-[10px]">
                  Parked
                </Badge>
              ) : null}
              <PayBadge ticket={ticket} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-mono">{orderRef(ticket.id)}</span>
              {` · ${ticket.outlet}`}
              {ticket.covers ? ` · ${ticket.covers} covers` : ""}
              {table ? ` · ${table}` : ""}
              {` · ${timeLabel(ticket.settled_at ?? ticket.created_at)}`}
            </p>
            {ticket.phone ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {ticket.phone}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-base font-semibold tabular-nums text-foreground">
              {formatBtn(ticket.total_btn)}
            </p>
            <Badge
              variant={ticket.kot_status === "ready" ? "gold" : "secondary"}
              className="mt-1 capitalize"
            >
              {ticket.kot_status}
            </Badge>
          </div>
        </div>
        <MoneyStrip ticket={ticket} />
      </div>

      <div className="rounded-lg border bg-card">
        <p className="border-b px-3 py-2 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Items · {ticket.order_items.length}
        </p>
        {ticket.order_items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No items on this ticket.
          </p>
        ) : (
          <div className="space-y-3 p-3">
            {groups.map((g) => (
              <div key={g.station} className="space-y-1">
                <p className="text-[10px] font-semibold tracking-wide text-accent uppercase">
                  {g.label}
                </p>
                <ul className="space-y-0.5 text-sm text-foreground">
                  {g.lines.map((i, idx) => (
                    <li key={idx} className="flex justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        {i.qty}× {i.name}
                        {i.course_no > 1 ? ` · course ${i.course_no}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {awaitingPayment ? (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">
            Send slip {orderRef(ticket.id)} to {ticket.phone}, then enter the
            journal number the guest sends back.
          </p>
          <RecordOrderPaymentForm orderId={ticket.id} compact />
        </div>
      ) : null}

      {canChargeRoom ? (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Charge to room
          </p>
          <p className="text-[11px] text-muted-foreground">
            Posts the full ticket to the in-house guest folio. Guest pays at
            checkout. Tax invoice issues from the folio, not this ticket.
          </p>
          <select
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
          >
            <option value="">Select in-house guest</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.rooms.map((r) => r.label).join(", ") || "Room"} ·{" "}
                {b.contact_name ?? "Guest"}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="citrus"
            className="w-full"
            disabled={!bookingId || postPending}
            onClick={() => onPostToRoom(ticket.id, bookingId)}
          >
            {postPending ? "Posting…" : "Charge to room"}
          </Button>
        </div>
      ) : null}

      {ticket.folio_id && ticket.posted_to_folio_at ? (
        <p className="text-xs text-muted-foreground">
          On guest folio. Issue tax invoice from the folio when needed.{" "}
          <Link
            href={`/erp/folios/${ticket.folio_id}`}
            className="text-accent underline-offset-4 hover:underline"
          >
            Open folio →
          </Link>
        </p>
      ) : null}

      <div>{actions}</div>
    </div>
  );
}
