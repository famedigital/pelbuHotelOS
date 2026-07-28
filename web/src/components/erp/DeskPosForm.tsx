"use client";

import { createDeskOrder, type DeskPosState } from "@/app/actions/erp-pos";
import type { MenuItem } from "@/lib/menu";
import { BHUTAN_GST_RATE, calculateOrderTotals, formatBtn } from "@/lib/pricing";
import { useActionState, useMemo, useState } from "react";

export type DeskBookingOption = {
  id: string;
  contact_name: string | null;
  check_in: string;
  check_out: string;
  status: string;
};

const initial: DeskPosState = { ok: false };

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold";
}

type Props = {
  items: MenuItem[];
  bookings: DeskBookingOption[];
};

export function DeskPosForm({ items, bookings }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [outlet, setOutlet] = useState("cafe");
  const [settleMode, setSettleMode] = useState<"cash" | "room_charge">("cash");
  const [state, action, pending] = useActionState(createDeskOrder, initial);

  const outletItems = useMemo(
    () => items.filter((item) => item.outlet === outlet),
    [items, outlet],
  );

  const cartPayload = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([menuItemId, qty]) => ({ menuItemId, qty })),
    [cart],
  );

  const totals = useMemo(() => {
    const lines = cartPayload.flatMap((line) => {
      const item = outletItems.find((m) => m.id === line.menuItemId);
      if (!item) return [];
      return [
        {
          qty: line.qty,
          unitPriceBtn: item.price_btn,
          gstApplicable: item.gst_applicable,
        },
      ];
    });
    return calculateOrderTotals(lines);
  }, [cartPayload, outletItems]);

  const byCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of outletItems) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [outletItems]);

  function setQty(id: string, next: number) {
    setCart((prev) => {
      const copy = { ...prev };
      if (next <= 0) delete copy[id];
      else copy[id] = Math.min(40, next);
      return copy;
    });
  }

  if (state.ok && state.orderId) {
    return (
      <div className="border border-espresso/10 bg-white px-6 py-8" role="status">
        <p className="text-xs tracking-[0.25em] text-gold uppercase">Ticket saved</p>
        <h2 className="mt-3 text-2xl text-espresso">Order is on the KOT board</h2>
        <p className="mt-2 text-sm text-muted">
          Ref <span className="font-mono text-espresso">{state.orderId}</span>
          {state.totalBtn != null ? ` · ${formatBtn(state.totalBtn)}` : ""}
          {state.folioId ? ` · folio ${state.folioId.slice(0, 8)}` : ""}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/erp/pos"
            className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
          >
            New ticket
          </a>
          <a
            href="/erp"
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-5 text-sm text-espresso"
          >
            Order board
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-8 border border-espresso/10 bg-white px-6 py-8">
      {state.error ? (
        <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="cart" value={JSON.stringify(cartPayload)} />

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Ticket
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-espresso">
            Outlet
            <select
              name="outlet"
              value={outlet}
              onChange={(e) => {
                setOutlet(e.target.value);
                setCart({});
              }}
              className={fieldClassName()}
            >
              <option value="cafe">Cafe</option>
              <option value="pastry">Pastry</option>
              <option value="restaurant">Restaurant</option>
              <option value="bar">Bar</option>
            </select>
          </label>
          <label className="block text-sm text-espresso">
            Settle
            <select
              name="settle_mode"
              value={settleMode}
              onChange={(e) =>
                setSettleMode(e.target.value as "cash" | "room_charge")
              }
              className={fieldClassName()}
            >
              <option value="cash">Cash / walk-in</option>
              <option value="room_charge">Charge to room folio</option>
            </select>
          </label>
          <label className="block text-sm text-espresso">
            Guest name
            <input type="text" name="customer_name" required className={fieldClassName()} />
          </label>
          <label className="block text-sm text-espresso">
            Phone
            <input type="tel" name="phone" required className={fieldClassName()} />
          </label>
          {settleMode === "room_charge" ? (
            <label className="block text-sm text-espresso sm:col-span-2">
              Booking folio
              <select name="booking_id" required defaultValue="" className={fieldClassName()}>
                <option value="" disabled>
                  Select in-house / confirmed booking
                </option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {(b.contact_name ?? "Guest")} · {b.check_in} → {b.check_out} ·{" "}
                    {b.status}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="booking_id" value="" />
          )}
          <label className="block text-sm text-espresso sm:col-span-2">
            Notes
            <textarea name="notes" rows={2} className={fieldClassName()} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Menu
        </legend>
        {byCategory.length === 0 ? (
          <p className="text-sm text-muted">No items for this outlet.</p>
        ) : (
          byCategory.map(([category, categoryItems]) => (
            <section key={category}>
              <h3 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
                {category}
              </h3>
              <ul className="mt-3 divide-y divide-espresso/10 border-y border-espresso/10">
                {categoryItems.map((item) => {
                  const qty = cart[item.id] ?? 0;
                  return (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-espresso">{item.name}</p>
                        <p className="text-xs text-muted">
                          {formatBtn(item.price_btn)}
                          {item.gst_applicable ? " · GST" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-espresso/20 text-espresso"
                          onClick={() => setQty(item.id, qty - 1)}
                          aria-label={`Decrease ${item.name}`}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">{qty}</span>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-espresso/20 text-espresso"
                          onClick={() => setQty(item.id, qty + 1)}
                          aria-label={`Increase ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </fieldset>

      <div className="border-t border-espresso/10 pt-5 text-sm">
        <p className="flex justify-between text-muted">
          <span>Subtotal</span>
          <span>{formatBtn(totals.subtotalBtn)}</span>
        </p>
        <p className="mt-1 flex justify-between text-muted">
          <span>GST ({Math.round(BHUTAN_GST_RATE * 100)}%)</span>
          <span>{formatBtn(totals.gstBtn)}</span>
        </p>
        <p className="mt-2 flex justify-between text-base font-medium text-espresso">
          <span>Total</span>
          <span>{formatBtn(totals.totalBtn)}</span>
        </p>
      </div>

      <button
        type="submit"
        disabled={pending || cartPayload.length === 0}
        className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-6 text-sm font-medium text-ivory disabled:opacity-60"
      >
        {pending ? "Saving…" : "Send to kitchen"}
      </button>
    </form>
  );
}
