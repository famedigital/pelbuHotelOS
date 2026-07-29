"use client";

import { createOrder, type OrderActionState } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { MenuItem } from "@/lib/menu";
import { BHUTAN_GST_RATE, calculateOrderTotals, formatBtn } from "@/lib/pricing";
import { useActionState, useMemo, useState } from "react";

const initial: OrderActionState = { ok: false };
type CartMap = Record<string, number>;

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
    <Button type="button" variant="outline" size="sm" onClick={onCopy}>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function OrderForm({ items }: { items: MenuItem[] }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [cart, setCart] = useState<CartMap>({});
  const [deliveryType, setDeliveryType] = useState<"pickup" | "taxi">("pickup");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
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
      if (next <= 0) delete copy[id];
      else copy[id] = Math.min(40, next);
      return copy;
    });
  }

  if (state.ok && state.orderId) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <h2 className="font-display text-2xl text-ink">Order received</h2>
        <p className="text-sm text-muted-foreground">
          Total {formatBtn(state.totalBtn ?? 0)}. Reference:{" "}
          <span className="font-mono text-ink">{state.orderId}</span>{" "}
          <CopyReference value={state.orderId} />
        </p>
        <Button asChild variant="outline">
          <a href="/cafe">Back to cafe</a>
        </Button>
      </div>
    );
  }

  const cartLineCount = cartPayload.length;
  const showStickyBar = !isDesktop && cartLineCount > 0;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_300px]">
      <section className="space-y-10" aria-label="Menu">
        {byCategory.map(([category, categoryItems]) => (
          <div key={category}>
            <h2 className="text-sm font-medium text-ink">{category}</h2>
            <ul className="mt-3 divide-y divide-border">
              {categoryItems.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="max-w-xl">
                      <p className="text-[15px] text-ink">{item.name}</p>
                      {item.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-sm tabular-nums text-ink">
                        {formatBtn(item.price_btn)}
                        {item.gst_applicable ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            +GST
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name}`}
                        disabled={qty === 0}
                        onClick={() => setQty(item.id, qty - 1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-ink disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-mono text-sm tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name}`}
                        onClick={() => setQty(item.id, qty + 1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-ink"
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

      {isDesktop ? (
        <aside className="md:sticky md:top-6 md:self-start">
          <CartPanel
            cartPayload={cartPayload}
            items={items}
            totals={totals}
            deliveryType={deliveryType}
            onDeliveryType={setDeliveryType}
            state={state}
            action={action}
            pending={pending}
          />
        </aside>
      ) : null}

      {showStickyBar ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background md:hidden">
          <button
            type="button"
            onClick={() => setMobileCartOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            aria-expanded={mobileCartOpen}
          >
            <span className="text-sm text-ink">
              {cartLineCount} item{cartLineCount === 1 ? "" : "s"} ·{" "}
              {formatBtn(totals.totalBtn)}
            </span>
            <span className="text-sm text-muted-foreground">
              {mobileCartOpen ? "Hide" : "Cart"}
            </span>
          </button>
          {mobileCartOpen ? (
            <div className="max-h-[70vh] overflow-auto px-5 pb-6">
              <CartPanel
                cartPayload={cartPayload}
                items={items}
                totals={totals}
                deliveryType={deliveryType}
                onDeliveryType={setDeliveryType}
                state={state}
                action={action}
                pending={pending}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CartPanel({
  cartPayload,
  items,
  totals,
  deliveryType,
  onDeliveryType,
  state,
  action,
  pending,
}: {
  cartPayload: { menuItemId: string; qty: number }[];
  items: MenuItem[];
  totals: ReturnType<typeof calculateOrderTotals>;
  deliveryType: "pickup" | "taxi";
  onDeliveryType: (v: "pickup" | "taxi") => void;
  state: OrderActionState;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  const empty = cartPayload.length === 0;

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="cart" value={JSON.stringify(cartPayload)} />

      <div>
        <p className="text-sm font-medium text-ink">Cart</p>
        {empty ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Add items from the menu.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {cartPayload.map((line) => {
              const item = items.find((m) => m.id === line.menuItemId);
              if (!item) return null;
              return (
                <li
                  key={line.menuItemId}
                  className="flex justify-between gap-2"
                >
                  <span>
                    ×{line.qty} {item.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatBtn(item.price_btn * line.qty)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {state.error ? (
        <p className="text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatBtn(totals.subtotalBtn)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>GST ({Math.round(BHUTAN_GST_RATE * 100)}%)</span>
          <span className="tabular-nums">{formatBtn(totals.gstBtn)}</span>
        </div>
        <div className="flex justify-between pt-1 font-medium text-ink">
          <span>Total</span>
          <span className="tabular-nums">{formatBtn(totals.totalBtn)}</span>
        </div>
      </div>

      <fieldset className="space-y-3" disabled={empty}>
        <div className="grid gap-2">
          <Label htmlFor="customer-name">Name</Label>
          <Input
            id="customer-name"
            name="customer_name"
            required
            autoComplete="name"
            maxLength={120}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            name="phone"
            required
            autoComplete="tel"
            placeholder="+975 …"
            maxLength={24}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="delivery_type"
              value="pickup"
              checked={deliveryType === "pickup"}
              onChange={() => onDeliveryType("pickup")}
            />
            Pickup
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="delivery_type"
              value="taxi"
              checked={deliveryType === "taxi"}
              onChange={() => onDeliveryType("taxi")}
            />
            Taxi
          </label>
        </div>
        {deliveryType === "taxi" ? (
          <div className="grid gap-2">
            <Label htmlFor="delivery-address">Address</Label>
            <Textarea
              id="delivery-address"
              name="delivery_address"
              required
              rows={2}
              maxLength={400}
            />
          </div>
        ) : (
          <input type="hidden" name="delivery_address" value="" />
        )}
        <div className="grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={2} maxLength={500} />
        </div>
      </fieldset>

      <Button type="submit" className="w-full" disabled={pending || empty}>
        {pending ? "Placing…" : "Place order"}
      </Button>
    </form>
  );
}
