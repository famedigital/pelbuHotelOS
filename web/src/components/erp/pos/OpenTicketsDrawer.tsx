"use client";

import {
  confirmPublicOrder,
  parkOrder,
  recallOrder,
  type ConfirmOrderState,
  unparkOrder,
  updateOrderKotStatus,
  type PosActionState,
} from "@/app/actions/erp-pos";
import { DeskLiveRefresh } from "@/components/erp/DeskLiveRefresh";
import { RecordOrderPaymentForm } from "@/components/erp/RecordOrderPaymentForm";
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
  items: { name_snapshot: string; qty: number; course_no: number; prep_station: string }[],
): { station: string; label: string; lines: { qty: number; name: string; course_no: number }[] }[] {
  const map = new Map<string, { qty: number; name: string; course_no: number }[]>();
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
  // Stable order: kitchen first, then bar, pastry, grill, cold, then others.
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
  tables: DiningTable[];
  onSettle: (orderId: string) => void;
  onVoid: (orderId: string) => void;
};

export function OpenTicketsDrawer({
  open,
  onOpenChange,
  tickets,
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
  const [kotPending, startKotTransition] = useTransition();
  /** Ticket opened from the list — the drawer swaps to a detail view for it. */
  const [detailId, setDetailId] = useState<string | null>(null);

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
        setKotError(err instanceof Error ? err.message : "Could not update KOT.");
      }
    });
  }

  useActionToast(parkState, { successMessage: "Ticket parked" });
  useActionToast(unparkState, { successMessage: "Ticket unparked" });
  useActionToast(recallState, { successMessage: "Ticket recalled" });
  useActionToast(confirmState, {
    successMessage: "Order confirmed — open the slip and send it to the guest",
  });

  // Land the cashier on the confirmation slip as soon as a confirm succeeds,
  // so they can screenshot it without hunting for the ticket again.
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
    (t) => isOnline(t) && t.confirmed_at && !t.payment_recorded_at && !t.is_parked,
  );
  const parked = tickets.filter((t) => t.is_parked);
  const active = tickets.filter(
    (t) =>
      !t.is_parked && !(isOnline(t) && (!t.confirmed_at || !t.payment_recorded_at)),
  );
  const busy = parkPending || unparkPending || recallPending || kotPending || confirmPending;

  const detail = detailId ? (tickets.find((t) => t.id === detailId) ?? null) : null;

  /**
   * Every action a ticket can take, in one place, so the detail view offers the
   * same operations the grouped list does without duplicating per-group markup.
   */
  function ticketActions(t: OpenPosTicket) {
    const online = isOnline(t);
    return (
      <div className="flex flex-wrap gap-1.5">
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
        if (!next) setDetailId(null);
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
                : "Open tickets"}
            </SheetTitle>
            <DeskLiveRefresh label="Live" />
          </div>
          <SheetDescription>
            {detail
              ? "Full ticket — items, totals, and every action for this order."
              : "Tap a ticket to open it. Settle, recall, or void from here."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {kotError ? (
            <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {kotError}
            </p>
          ) : null}
          {detail ? (
            <TicketDetail
              ticket={detail}
              tables={tables}
              onBack={() => setDetailId(null)}
              actions={ticketActions(detail)}
            />
          ) : tickets.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-foreground">
                No open tickets
              </p>
              <p className="text-xs text-muted-foreground">
                New tickets and parked tickets will appear here.
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
                    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                      <p className="text-[11px] text-muted-foreground">
                        Send slip {orderRef(t.id)} to {t.phone}, then enter the
                        journal number the guest sends back.
                      </p>
                      <RecordOrderPaymentForm orderId={t.id} compact />
                    </div>
                  )}
                  actions={(t) => (
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
                  )}
                />
              ) : null}
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
              <TicketGroup
                title="Active"
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
                  {` · ${timeLabel(t.created_at)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {t.total_btn.toLocaleString("en-BT", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  Nu
                </p>
                <Badge
                  variant={t.kot_status === "ready" ? "gold" : "secondary"}
                  className="mt-1 capitalize"
                >
                  {t.kot_status}
                </Badge>
              </div>
            </button>

            {t.order_items.length > 0 ? (
              (() => {
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
                          {g.lines.slice(0, mixed ? 4 : 4).map((i, idx) => (
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
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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
              {actions(t)}
            </div>
            {footer ? footer(t) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Single-ticket view inside the same drawer. Opening a ticket used to do
 * nothing, so the desk had to guess which action button applied to which row.
 */
function TicketDetail({
  ticket,
  tables,
  onBack,
  actions,
}: {
  ticket: OpenPosTicket;
  tables: DiningTable[];
  onBack: () => void;
  actions: React.ReactNode;
}) {
  const groups = groupByPrepStation(ticket.order_items);
  const online = ticket.order_source === "public";
  const awaitingPayment =
    online && Boolean(ticket.confirmed_at) && !ticket.payment_recorded_at;
  const table = ticketTableLabel(ticket, tables);

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
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-mono">{orderRef(ticket.id)}</span>
              {` · ${ticket.outlet}`}
              {ticket.covers ? ` · ${ticket.covers} covers` : ""}
              {table ? ` · ${table}` : ""}
              {` · ${timeLabel(ticket.created_at)}`}
            </p>
            {ticket.phone ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {ticket.phone}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-base font-semibold tabular-nums text-foreground">
              {ticket.total_btn.toLocaleString("en-BT", {
                maximumFractionDigits: 2,
              })}{" "}
              Nu
            </p>
            <Badge
              variant={ticket.kot_status === "ready" ? "gold" : "secondary"}
              className="mt-1 capitalize"
            >
              {ticket.kot_status}
            </Badge>
          </div>
        </div>
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

      <div>{actions}</div>
    </div>
  );
}
