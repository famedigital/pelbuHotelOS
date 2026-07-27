"use client";

import { createOrder, type OrderActionState } from "@/app/actions/orders";
import type { MenuItem } from "@/lib/menu";
import { BHUTAN_GST_RATE, calculateOrderTotals, formatBtn } from "@/lib/pricing";
import { useActionState, useMemo, useState } from "react";

const initial: OrderActionState = { ok: false };

type CartMap = Record<string, number>;

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold";
}

function CopyReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex min-h-11 items-center rounded-sm border border-espresso/25 px-4 text-sm font-medium text-espresso transition-colors hover:border-gold"
      aria-label={copied ? "Reference copied" : "Copy reference"}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

type Props = {
  items: MenuItem[];
};

export function OrderForm({ items }: Props) {
  const [cart, setCart] = useState<CartMap>({});
  const [deliveryType, setDeliveryType] = useState<"pickup" | "taxi">("pickup");
  const [state, action, pending] = useActionState(createOrder, initial);

  const cartPayload = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([menuItemId, qty]) => ({ menuItemId, qty })),
    [cart],
  );

  const totals = useMemo(() => {
    const lines = cartPayload.flatMap((line) => {
      const item = items.find((m) => m.id === line.menuItemId);
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
  }, [cartPayload, items]);

  const byCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      const key = `${item.outlet} · ${item.category}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  function setQty(id: string, next: number) {
    setCart((prev) => {
      const copy = { ...prev };
      if (next <= 0) {
        delete copy[id];
      } else {
        copy[id] = Math.min(40, next);
      }
      return copy;
    });
  }

  if (state.ok && state.orderId) {
    const isTaxi = deliveryType === "taxi";
    const nextStep = isTaxi
      ? "We will arrange a taxi across Thimphu once the order is ready — keep your phone on."
      : "Pick it up at the cafe counter when we call or message that it is ready.";

    return (
      <div
        className="border border-espresso/10 bg-white px-6 py-8 sm:px-8"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs tracking-[0.25em] text-gold uppercase">Order received</p>
        <h2 className="mt-3 text-2xl text-espresso">The kitchen is on it.</h2>

        <ol className="mt-6 space-y-3 text-sm text-muted">
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              1
            </span>
            <span>The cafe desk has been notified and is preparing your order.</span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              2
            </span>
            <span>{nextStep}</span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              3
            </span>
            <span>
              Total {formatBtn(state.totalBtn ?? 0)} (incl. GST where applicable). Keep
              your reference for pickup or any follow-up.
            </span>
          </li>
        </ol>

        <div className="mt-6 space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Reference</p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-espresso break-all">{state.orderId}</p>
            <CopyReference value={state.orderId} />
          </div>
        </div>

        <a
          href="/cafe"
          className="mt-8 inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
        >
          Back to cafe
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="space-y-8" aria-label="Menu">
        {byCategory.map(([category, categoryItems]) => (
          <div key={category}>
            <h2 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
              {category}
            </h2>
            <ul className="mt-4 divide-y divide-espresso/10 border-y border-espresso/10">
              {categoryItems.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="max-w-xl">
                      <p className="text-base text-espresso">{item.name}</p>
                      {item.description ? (
                        <p className="mt-1 text-sm text-muted">{item.description}</p>
                      ) : null}
                      <p className="mt-2 text-sm text-espresso">
                        {formatBtn(item.price_btn)}
                        {item.gst_applicable ? (
                          <span className="text-muted"> · +GST</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name}`}
                        disabled={qty === 0}
                        onClick={() => setQty(item.id, qty - 1)}
                        className="inline-flex h-10 w-10 items-center justify-center border border-espresso/20 text-espresso disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name}`}
                        onClick={() => setQty(item.id, qty + 1)}
                        className="inline-flex h-10 w-10 items-center justify-center border border-espresso/20 text-espresso"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <form action={action} className="space-y-6 border-t border-espresso/10 pt-8" noValidate>
        <input type="hidden" name="cart" value={JSON.stringify(cartPayload)} />

        {state.error ? (
          <p
            className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium tracking-wide text-espresso">
            Your details
          </legend>
          <label className="block text-sm text-muted">
            Full name
            <input
              type="text"
              name="customer_name"
              required
              autoComplete="name"
              maxLength={120}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-muted">
            Phone
            <input
              type="tel"
              name="phone"
              required
              autoComplete="tel"
              placeholder="+975 …"
              maxLength={24}
              className={fieldClassName()}
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm text-muted">Delivery</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-espresso">
                <input
                  type="radio"
                  name="delivery_type"
                  value="pickup"
                  checked={deliveryType === "pickup"}
                  onChange={() => setDeliveryType("pickup")}
                />
                Pickup at cafe
              </label>
              <label className="flex items-center gap-2 text-sm text-espresso">
                <input
                  type="radio"
                  name="delivery_type"
                  value="taxi"
                  checked={deliveryType === "taxi"}
                  onChange={() => setDeliveryType("taxi")}
                />
                Taxi across Thimphu
              </label>
            </div>
          </div>

          {deliveryType === "taxi" ? (
            <label className="block text-sm text-muted">
              Address / landmark
              <textarea
                name="delivery_address"
                required
                rows={2}
                maxLength={400}
                placeholder="Area, building, or landmark"
                className={fieldClassName()}
              />
            </label>
          ) : (
            <input type="hidden" name="delivery_address" value="" />
          )}

          <label className="block text-sm text-muted">
            Notes
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              placeholder="Allergies, spice level, gate code…"
              className={fieldClassName()}
            />
          </label>
        </fieldset>

        <div className="space-y-1 border border-espresso/10 bg-white px-4 py-4 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span>{formatBtn(totals.subtotalBtn)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>GST ({Math.round(BHUTAN_GST_RATE * 100)}%)</span>
            <span>{formatBtn(totals.gstBtn)}</span>
          </div>
          <div className="flex justify-between pt-2 text-base text-espresso">
            <span>Total</span>
            <span>{formatBtn(totals.totalBtn)}</span>
          </div>
          <p className="pt-2 text-xs text-muted">
            Taxi fare is arranged separately with the driver — not included above.
          </p>
        </div>

        <button
          type="submit"
          disabled={pending || cartPayload.length === 0}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-gold px-6 text-sm font-medium text-espresso disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Placing order…" : "Place order"}
        </button>
      </form>
    </div>
  );
}
