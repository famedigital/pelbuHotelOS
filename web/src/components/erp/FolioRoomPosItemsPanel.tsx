"use client";

import {
  markOrderItemServed,
  voidOrderItem,
  type PosActionState,
} from "@/app/actions/erp-pos";
import type { RoomChargePosOrder } from "@/lib/folio/room-pos-orders-types";
import {
  POS_VOID_REASON_CODES,
  type PosVoidReasonCode,
} from "@/lib/pos-void-reasons";
import { formatBtn } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { cn } from "@/lib/utils";
import { useActionState, useEffect } from "react";

const initial: PosActionState = { ok: false };

const VOID_LABELS: Record<string, string> = {
  guest_change: "Guest says not ordered / not eaten",
  kitchen_error: "Kitchen error",
  wrong_item: "Wrong item",
  duplicate: "Duplicate charge",
  other: "Other",
  comp: "Comp",
  manager_comp: "Manager comp",
  training: "Training",
};

function selectClass() {
  return "mt-1 flex h-9 w-full max-w-[260px] items-center rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:border-ring";
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-BT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Thimphu",
  });
}

function kotTone(status: string): string {
  if (status === "served") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
  if (status === "ready") return "bg-amber-500/15 text-amber-900 dark:text-amber-100";
  if (status === "cancelled") return "bg-muted text-muted-foreground";
  if (status === "preparing") return "bg-sky-500/10 text-sky-900 dark:text-sky-100";
  return "bg-muted/80 text-muted-foreground";
}

function VoidItemForm({
  orderId,
  itemId,
  itemName,
  onDone,
}: {
  orderId: string;
  itemId: string;
  itemName: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(voidOrderItem, initial);
  useActionToast(state, { successMessage: `${itemName} removed from bill` });

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="mt-2 space-y-1.5 rounded-md border border-destructive/20 bg-destructive/5 p-2">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="order_item_id" value={itemId} />
      <p className="text-[11px] text-muted-foreground">
        Void this line only — restays on folio; removes charge + restocks when
        possible. Reason is audited.
      </p>
      <select
        name="reason_code"
        required
        defaultValue="guest_change"
        className={selectClass()}
      >
        {POS_VOID_REASON_CODES.map((code) => (
          <option key={code} value={code}>
            {VOID_LABELS[code] ?? code}
          </option>
        ))}
      </select>
      <Input
        name="reason_text"
        placeholder="Notes (optional)"
        className="h-8 text-xs"
      />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        disabled={pending}
        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {pending ? "Voiding…" : "Void item from folio"}
      </Button>
      {state.error ? (
        <p className="text-xs text-destructive" role="status">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function MarkServedForm({
  orderId,
  itemId,
  itemName,
  onDone,
}: {
  orderId: string;
  itemId: string;
  itemName: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(markOrderItemServed, initial);
  useActionToast(state, { successMessage: `${itemName} marked served` });

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="order_item_id" value={itemId} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        className="h-7 text-[11px]"
      >
        {pending ? "…" : "Mark served"}
      </Button>
      {state.error ? (
        <span className="text-[11px] text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}

export function FolioRoomPosItemsPanel({
  orders,
  onChanged,
  className,
}: {
  orders: RoomChargePosOrder[];
  onChanged?: () => void;
  className?: string;
}) {
  if (orders.length === 0) {
    return (
      <div className={cn("rounded-lg border bg-card p-4 text-sm text-muted-foreground", className)}>
        No room-charge F&amp;B yet. Café / restaurant posts appear here when
        charged to the room so front desk can verify every item at collection.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-muted-foreground">
        Every dish or drink charged to this room. Pass should mark{" "}
        <span className="font-medium text-foreground">served</span> (who + when
        is stored). If guest disputes after KOT, void the line — audited, folio
        rebalanced.
      </p>
      {orders.map((order) => {
        const activeItems = order.items.filter((i) => !i.voidedAt);
        const voidedItems = order.items.filter((i) => i.voidedAt);
        return (
          <article
            key={order.orderId}
            className="rounded-lg border bg-card p-3 sm:p-4"
          >
            <header className="flex flex-wrap items-start justify-between gap-2 border-b pb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {order.outlet} ·{" "}
                  <span className="font-normal text-muted-foreground">
                    {fmtWhen(order.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {order.postedToFolioAt
                    ? `On folio · ${fmtWhen(order.postedToFolioAt)}`
                    : "Not yet posted to folio"}
                  {order.customerName ? ` · ${order.customerName}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatBtn(order.totalBtn)}
                </p>
                <span
                  className={cn(
                    "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                    kotTone(order.kotStatus),
                  )}
                >
                  {order.kotLabel}
                </span>
              </div>
            </header>

            {order.servedBy || order.readyBy ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {order.readyBy ? (
                  <>
                    Ready by{" "}
                    <span className="font-medium text-foreground">
                      {order.readyBy}
                    </span>
                    {order.readyAt ? ` · ${fmtWhen(order.readyAt)}` : ""}
                  </>
                ) : null}
                {order.readyBy && order.servedBy ? " · " : null}
                {order.servedBy ? (
                  <>
                    Served by{" "}
                    <span className="font-medium text-foreground">
                      {order.servedBy}
                    </span>
                    {order.servedAt ? ` · ${fmtWhen(order.servedAt)}` : ""}
                  </>
                ) : null}
              </p>
            ) : order.voidedAt ? null : (
              <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
                Not marked served yet — confirm at pass or mark lines below
                before guest argument closes unclear.
              </p>
            )}

            <ul className="mt-3 divide-y">
              {activeItems.map((item) => (
                <li key={item.id} className="py-2.5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="min-w-0 flex-1 font-medium text-foreground">
                      {item.qty}× {item.name}
                      {item.lineNotes ? (
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          {item.lineNotes}
                        </span>
                      ) : null}
                    </p>
                    <p className="tabular-nums text-foreground">
                      {formatBtn(item.lineTotalBtn)}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        "rounded px-1 py-0.5 font-semibold tracking-wide uppercase",
                        kotTone(item.kotStatus),
                      )}
                    >
                      {item.kotLabel}
                    </span>
                    {item.servedBy ? (
                      <span>
                        Served by{" "}
                        <span className="text-foreground">{item.servedBy}</span>
                        {item.servedAt ? ` · ${fmtWhen(item.servedAt)}` : ""}
                      </span>
                    ) : item.readyBy ? (
                      <span>
                        Ready by{" "}
                        <span className="text-foreground">{item.readyBy}</span>
                        {item.readyAt ? ` · ${fmtWhen(item.readyAt)}` : ""}
                      </span>
                    ) : (
                      <span>Awaiting serve confirm</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-start gap-2">
                    {item.kotStatus !== "served" &&
                    item.kotStatus !== "cancelled" ? (
                      <MarkServedForm
                        orderId={order.orderId}
                        itemId={item.id}
                        itemName={item.name}
                        onDone={onChanged}
                      />
                    ) : null}
                    <details className="group w-full max-w-sm">
                      <summary className="cursor-pointer list-none text-[11px] font-medium text-destructive underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                        Guest dispute / void
                      </summary>
                      <VoidItemForm
                        orderId={order.orderId}
                        itemId={item.id}
                        itemName={item.name}
                        onDone={onChanged}
                      />
                    </details>
                  </div>
                </li>
              ))}
            </ul>

            {voidedItems.length > 0 ? (
              <div className="mt-2 border-t pt-2">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Voided (audit)
                </p>
                <ul className="mt-1 space-y-1">
                  {voidedItems.map((item) => (
                    <li
                      key={item.id}
                      className="text-xs text-muted-foreground line-through"
                    >
                      {item.qty}× {item.name}
                      {item.voidReason ? ` · ${item.voidReason}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export type { RoomChargePosOrder, PosVoidReasonCode };

