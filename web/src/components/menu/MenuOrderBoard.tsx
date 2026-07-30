"use client";

import { createOrder, type OrderActionState } from "@/app/actions/orders";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import { THIMPHU_DELIVERY_AREAS } from "@/lib/delivery-areas";
import type { MenuItem } from "@/lib/menu";
import { orderRef } from "@/lib/order-ref";
import { BHUTAN_GST_RATE, calculateOrderTotals, formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { MinusIcon, PlusIcon, SearchIcon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";

const OUTLETS = [
  { id: "all", label: "All" },
  { id: "cafe", label: "Cafe" },
  { id: "pastry", label: "Pastry" },
  { id: "restaurant", label: "Restaurant" },
  { id: "bar", label: "Bar" },
] as const;

type OutletId = (typeof OUTLETS)[number]["id"];
/** Cafe and pastry share one kitchen ticket; restaurant prints its own. */
type Ticket = "cafe" | "restaurant";

const TICKET_LABEL: Record<Ticket, string> = {
  cafe: "Cafe & pastry",
  restaurant: "Restaurant",
};

const initialState: OrderActionState = { ok: false };

function ticketOf(item: MenuItem): Ticket {
  return item.outlet === "restaurant" ? "restaurant" : "cafe";
}

function isOrderable(item: MenuItem): boolean {
  return item.outlet !== "bar" && !item.sold_out;
}

export function MenuOrderBoard({
  items,
  initialOutlet,
}: {
  items: MenuItem[];
  initialOutlet?: OutletId;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [query, setQuery] = useState("");
  const [outlet, setOutlet] = useState<OutletId>(initialOutlet ?? "all");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [deliveryType, setDeliveryType] = useState<"pickup" | "taxi">("pickup");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [conflict, setConflict] = useState<MenuItem | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [state, action, pending] = useActionState(createOrder, initialState);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash.startsWith("item-")) return;
    const id = hash.slice("item-".length);
    const target = items.find((item) => item.id === id);
    if (!target) return;
    const nextOutlet =
      (OUTLETS.find((entry) => entry.id === target.outlet)?.id as OutletId) ??
      "all";
    const frame = window.requestAnimationFrame(() => {
      setOutlet(nextOutlet);
      setCategory("all");
      setHighlightId(id);
      document
        .getElementById(`item-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items]);

  const categories = useMemo(() => {
    const scoped =
      outlet === "all" ? items : items.filter((item) => item.outlet === outlet);
    return ["all", ...new Set(scoped.map((item) => item.category))];
  }, [items, outlet]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (outlet !== "all" && item.outlet !== outlet) return false;
      if (category !== "all" && item.category !== category) return false;
      if (!q) return true;
      return `${item.name} ${item.description ?? ""} ${item.category} ${item.outlet}`
        .toLowerCase()
        .includes(q);
    });
  }, [category, items, outlet, query]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([menuItemId, qty]) => ({ menuItemId, qty })),
    [cart],
  );

  const cartTicket: Ticket | null = useMemo(() => {
    for (const line of cartLines) {
      const item = items.find((entry) => entry.id === line.menuItemId);
      if (item) return ticketOf(item);
    }
    return null;
  }, [cartLines, items]);

  const totals = useMemo(() => {
    const lines = cartLines.flatMap((line) => {
      const item = items.find((entry) => entry.id === line.menuItemId);
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
  }, [cartLines, items]);

  const cartCount = cartLines.reduce((sum, line) => sum + line.qty, 0);

  function setQty(id: string, next: number) {
    setCart((prev) => {
      const copy = { ...prev };
      if (next <= 0) delete copy[id];
      else copy[id] = Math.min(40, next);
      return copy;
    });
  }

  function addItem(item: MenuItem) {
    if (!isOrderable(item)) return;
    if (cartTicket && ticketOf(item) !== cartTicket) {
      setConflict(item);
      return;
    }
    setQty(item.id, (cart[item.id] ?? 0) + 1);
  }

  function startNewTicket(item: MenuItem) {
    setCart({ [item.id]: 1 });
    setConflict(null);
  }

  if (state.ok && state.orderId) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-lg rounded-2xl border border-mint-100 bg-mint-100/40 px-6 py-10 text-center"
      >
        <h2 className="font-display text-2xl text-foreground">Order received</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Total {formatBtn(state.totalBtn ?? 0)}. The desk will WhatsApp you a
          confirmation with payment details — send the transfer journal number
          back and the kitchen starts cooking.
        </p>
        <p className="mt-4 font-mono text-lg text-foreground">
          {orderRef(state.orderId)}
        </p>
        <Button asChild variant="citrus" className="mt-6">
          <a href="/menu">Start another order</a>
        </Button>
      </div>
    );
  }

  const cartPanel = (
    <OrderCart
      cartLines={cartLines}
      items={items}
      totals={totals}
      ticket={cartTicket}
      onQty={setQty}
      onClear={() => setCart({})}
      deliveryType={deliveryType}
      onDeliveryType={setDeliveryType}
      deliveryArea={deliveryArea}
      onDeliveryArea={setDeliveryArea}
      state={state}
      action={action}
      pending={pending}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="min-w-0" aria-label="Menu">
        <div className="sticky top-[3.75rem] z-20 -mx-4 space-y-2.5 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:px-3 lg:py-2.5">
          <div className="relative">
            <SearchIcon
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search momos, pastry, dinner…"
              aria-label="Search the menu"
              className="h-10 rounded-xl pl-10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {OUTLETS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setOutlet(entry.id);
                  setCategory("all");
                }}
                aria-pressed={outlet === entry.id}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  outlet === entry.id
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-border bg-card text-foreground hover:bg-secondary",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setCategory(entry)}
                aria-pressed={category === entry}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                  category === entry
                    ? "bg-mint-100 text-mint-600"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {entry === "all" ? "All dishes" : entry}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-4 rounded-xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
            No dishes match that search. Try another outlet or clear the filter.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((item) => (
              <MenuTile
                key={item.id}
                item={item}
                qty={cart[item.id] ?? 0}
                highlighted={highlightId === item.id}
                onAdd={() => addItem(item)}
                onDecrease={() => setQty(item.id, (cart[item.id] ?? 0) - 1)}
              />
            ))}
          </ul>
        )}
      </section>

      {isDesktop ? (
        <aside className="lg:sticky lg:top-[4.75rem] lg:self-start">
          {cartPanel}
        </aside>
      ) : (
        <>
          {cartCount > 0 ? (
            <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background px-5 py-3 shadow-[0_-8px_30px_rgba(8,47,73,0.12)] lg:hidden">
              <Button
                type="button"
                variant="citrus"
                className="h-12 w-full justify-between text-[15px]"
                onClick={() => setCartOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <ShoppingBagIcon className="size-4" />
                  {cartCount} item{cartCount === 1 ? "" : "s"}
                </span>
                <span className="tabular-nums">
                  {formatBtn(totals.totalBtn)} · Checkout
                </span>
              </Button>
            </div>
          ) : null}
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetContent
              side="bottom"
              className="max-h-[88dvh] overflow-y-auto rounded-t-2xl px-5 pb-8"
            >
              <SheetHeader className="px-0">
                <SheetTitle>Your order</SheetTitle>
              </SheetHeader>
              {cartPanel}
            </SheetContent>
          </Sheet>
        </>
      )}

      <Dialog
        open={Boolean(conflict)}
        onOpenChange={(open) => {
          if (!open) setConflict(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Separate kitchen tickets</DialogTitle>
            <DialogDescription>
              {conflict
                ? `${TICKET_LABEL[cartTicket ?? "cafe"]} and ${TICKET_LABEL[ticketOf(conflict)].toLowerCase()} items are cooked and billed on different tickets, so they cannot share one order.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              variant="citrus"
              onClick={() => conflict && startNewTicket(conflict)}
            >
              Start a {conflict ? TICKET_LABEL[ticketOf(conflict)].toLowerCase() : ""} order
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConflict(null)}
            >
              Keep current order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MenuTile({
  item,
  qty,
  highlighted,
  onAdd,
  onDecrease,
}: {
  item: MenuItem;
  qty: number;
  highlighted: boolean;
  onAdd: () => void;
  onDecrease: () => void;
}) {
  const orderable = isOrderable(item);

  return (
    <HoverCard openDelay={160} closeDelay={80}>
      <HoverCardTrigger asChild>
        <li
          id={`item-${item.id}`}
          className={cn(
            "media-card flex scroll-mt-40 flex-col overflow-hidden rounded-xl border bg-card",
            highlighted
              ? "border-sky-600 ring-2 ring-sky-600/25"
              : "border-border",
          )}
        >
          <div className="relative">
            <CloudinaryImage
              publicId={item.image_public_id}
              src={item.image_src}
              alt={item.name}
              ratio="4/3"
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, (max-width: 1536px) 22vw, 16vw"
            />
            {qty > 0 ? (
              <span className="absolute left-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white shadow-sm">
                {qty}
              </span>
            ) : null}
            {item.is_popular ? (
              <span className="absolute right-2 top-2 rounded-full bg-citrus px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-ink">
                Popular
              </span>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col p-2.5">
            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
              {item.name}
            </p>
            {item.description ? (
              <span className="sr-only">{item.description}</span>
            ) : null}
            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <span className="text-[13px] font-semibold tabular-nums text-sky-700">
                {formatBtn(item.price_btn)}
              </span>
              {item.sold_out ? (
                <span className="rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] font-semibold text-destructive">
                  Sold out
                </span>
              ) : !orderable ? (
                <Link
                  href="/contact"
                  className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Ask desk
                </Link>
              ) : qty === 0 ? (
                <button
                  type="button"
                  aria-label={`Add ${item.name}`}
                  onClick={onAdd}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-citrus text-sky-ink transition-colors hover:bg-citrus-soft"
                >
                  <PlusIcon className="size-4" />
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    aria-label={`Remove one ${item.name}`}
                    onClick={onDecrease}
                    className="inline-flex size-7 items-center justify-center rounded-md text-foreground hover:bg-secondary"
                  >
                    <MinusIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Add one ${item.name}`}
                    onClick={onAdd}
                    className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
                  >
                    <PlusIcon className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </li>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="hidden w-72 overflow-hidden p-0 lg:block"
      >
        <CloudinaryImage
          publicId={item.image_public_id}
          src={item.image_src}
          alt=""
          ratio="16/10"
          sizes="288px"
        />
        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold leading-snug text-foreground">
              {item.name}
            </p>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-sky-700">
              {formatBtn(item.price_btn)}
            </p>
          </div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {item.outlet} · {item.category}
            {item.gst_applicable ? " · +GST" : ""}
          </p>
          {item.description ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          ) : null}
          {!orderable ? (
            <p className="text-xs text-muted-foreground">
              Bar service is handled at the desk, not through online ordering.
            </p>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function OrderCart({
  cartLines,
  items,
  totals,
  ticket,
  onQty,
  onClear,
  deliveryType,
  onDeliveryType,
  deliveryArea,
  onDeliveryArea,
  state,
  action,
  pending,
}: {
  cartLines: { menuItemId: string; qty: number }[];
  items: MenuItem[];
  totals: ReturnType<typeof calculateOrderTotals>;
  ticket: Ticket | null;
  onQty: (id: string, next: number) => void;
  onClear: () => void;
  deliveryType: "pickup" | "taxi";
  onDeliveryType: (value: "pickup" | "taxi") => void;
  deliveryArea: string;
  onDeliveryArea: (value: string) => void;
  state: OrderActionState;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  const empty = cartLines.length === 0;

  return (
    <form
      action={action}
      noValidate
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card lg:max-h-[calc(100dvh-6rem)] lg:shadow-sm"
    >
      <input
        type="hidden"
        name="cart"
        value={JSON.stringify(cartLines)}
        readOnly
      />

      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="font-semibold text-foreground">Your order</p>
          <p className="text-xs text-muted-foreground">
            {ticket ? `${TICKET_LABEL[ticket]} ticket` : "Pickup or Thimphu taxi"}
          </p>
        </div>
        {empty ? null : (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {empty ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Tap Add on any dish to build your order. Nothing else to click.
          </p>
        ) : (
          <ul className="space-y-3">
            {cartLines.map((line) => {
              const item = items.find((entry) => entry.id === line.menuItemId);
              if (!item) return null;
              return (
                <li key={line.menuItemId} className="flex items-start gap-3">
                  <div className="flex items-center gap-1 rounded-lg border border-border">
                    <button
                      type="button"
                      aria-label={`Remove one ${item.name}`}
                      onClick={() => onQty(item.id, line.qty - 1)}
                      className="inline-flex size-8 items-center justify-center rounded-md text-foreground hover:bg-secondary"
                    >
                      <MinusIcon className="size-3.5" />
                    </button>
                    <span className="w-5 text-center font-mono text-sm tabular-nums">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add one ${item.name}`}
                      onClick={() => onQty(item.id, line.qty + 1)}
                      className="inline-flex size-8 items-center justify-center rounded-md text-foreground hover:bg-secondary"
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                  </div>
                  <p className="min-w-0 flex-1 text-sm leading-6 text-foreground">
                    {item.name}
                  </p>
                  <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {formatBtn(item.price_btn * line.qty)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatBtn(totals.subtotalBtn)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>GST ({Math.round(BHUTAN_GST_RATE * 100)}%)</span>
            <span className="tabular-nums">{formatBtn(totals.gstBtn)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-semibold text-foreground">
            <span>Total</span>
            <span className="tabular-nums">{formatBtn(totals.totalBtn)}</span>
          </div>
        </div>

        {state.error ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}

        <fieldset className="mt-4 space-y-3" disabled={empty}>
          <div className="grid gap-1.5">
            <Label htmlFor="customer-name">Name</Label>
            <Input
              id="customer-name"
              name="customer_name"
              required
              autoComplete="name"
              maxLength={120}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="+975 …"
              maxLength={24}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["pickup", "taxi"] as const).map((option) => (
              <label
                key={option}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium capitalize transition-colors",
                  deliveryType === option
                    ? "border-sky-600 bg-sky-100 text-sky-700"
                    : "border-border text-foreground hover:bg-secondary",
                )}
              >
                <input
                  type="radio"
                  name="delivery_type"
                  value={option}
                  checked={deliveryType === option}
                  onChange={() => onDeliveryType(option)}
                  className="sr-only"
                />
                {option === "taxi" ? "Taxi delivery" : "Pickup"}
              </label>
            ))}
          </div>
          {deliveryType === "taxi" ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="delivery-area">Thimphu area</Label>
                <select
                  id="delivery-area"
                  name="delivery_area"
                  required
                  value={deliveryArea}
                  onChange={(event) => onDeliveryArea(event.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Choose area…</option>
                  {THIMPHU_DELIVERY_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="delivery-address">Landmark / detail</Label>
                <Textarea
                  id="delivery-address"
                  name="delivery_address"
                  required
                  rows={2}
                  maxLength={400}
                  placeholder="Building colour, floor, gate detail…"
                />
              </div>
            </>
          ) : (
            <>
              <input type="hidden" name="delivery_area" value="" />
              <input type="hidden" name="delivery_address" value="" />
            </>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} maxLength={500} />
          </div>
        </fieldset>
      </div>

      <div className="border-t border-border p-4">
        <Button
          type="submit"
          variant="citrus"
          className="h-12 w-full text-[15px]"
          disabled={pending || empty}
        >
          {pending
            ? "Placing…"
            : empty
              ? "Add items to order"
              : `Place order · ${formatBtn(totals.totalBtn)}`}
        </Button>
      </div>
    </form>
  );
}
