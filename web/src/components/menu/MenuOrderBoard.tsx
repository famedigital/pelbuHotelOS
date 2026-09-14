"use client";

import { createOrder, type OrderActionState } from "@/app/actions/orders";
import {
  fetchInHouseRoomLabels,
  verifyGuestRoomForOrder,
  type VerifyGuestRoomState,
} from "@/app/actions/guest-room-order";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { usePublicMenuChromeOptional } from "@/components/site/public-menu-chrome";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  calculateOrderTotals,
  formatBtn,
  formatGuestBtn,
  withGuestFacingTotal,
} from "@/lib/pricing";
import { DEFAULT_GST_RATE } from "@/lib/property-settings";
import { cn } from "@/lib/utils";
import { MinusIcon, PlusIcon, SearchIcon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";

const ROOM_TOKEN_KEY = "pelbu_guest_room_token";
const ROOM_LABEL_KEY = "pelbu_guest_room_label";

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
  preferRoomDelivery = false,
  /** Prefill from QR /menu?table=T12 — guest notes, not desk ticket yet. */
  initialTableLabel,
  /** Property GST rate from ERP settings (`properties.gst_rate`). */
  gstRate = DEFAULT_GST_RATE,
}: {
  items: MenuItem[];
  initialOutlet?: OutletId;
  preferRoomDelivery?: boolean;
  initialTableLabel?: string;
  gstRate?: number;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const menuChrome = usePublicMenuChromeOptional();
  const [query, setQuery] = useState("");
  const [outlet, setOutlet] = useState<OutletId>(initialOutlet ?? "all");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [deliveryType, setDeliveryType] = useState<
    "pickup" | "taxi" | "room"
  >(preferRoomDelivery ? "room" : "pickup");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [conflict, setConflict] = useState<MenuItem | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [state, action, pending] = useActionState(createOrder, initialState);
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [roomLabel, setRoomLabel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = sessionStorage.getItem(ROOM_TOKEN_KEY);
      const l = sessionStorage.getItem(ROOM_LABEL_KEY);
      if (t && l) {
        setRoomToken(t);
        setRoomLabel(l);
        setDeliveryType("room");
      }
    } catch {
      /* private mode */
    }
  }, []);

  function bindRoomSession(token: string, label: string) {
    setRoomToken(token);
    setRoomLabel(label);
    setDeliveryType("room");
    try {
      sessionStorage.setItem(ROOM_TOKEN_KEY, token);
      sessionStorage.setItem(ROOM_LABEL_KEY, label);
    } catch {
      /* private mode */
    }
  }

  function clearRoomSession() {
    setRoomToken(null);
    setRoomLabel(null);
    try {
      sessionStorage.removeItem(ROOM_TOKEN_KEY);
      sessionStorage.removeItem(ROOM_LABEL_KEY);
    } catch {
      /* private mode */
    }
    if (deliveryType === "room") setDeliveryType("pickup");
  }

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

  const resolvedGstRate = Math.max(0, Number(gstRate) || DEFAULT_GST_RATE);

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
    return withGuestFacingTotal(
      calculateOrderTotals(lines, { gstRate: resolvedGstRate }),
    );
  }, [cartLines, items, resolvedGstRate]);

  const cartCount = cartLines.reduce((sum, line) => sum + line.qty, 0);

  useEffect(() => {
    menuChrome?.setCartActive(cartCount > 0);
    return () => {
      menuChrome?.setCartActive(false);
    };
  }, [cartCount, menuChrome?.setCartActive]);

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
        className="mx-auto max-w-lg rounded-2xl border border-mint-100 bg-mist-1/40 px-6 py-10 text-center"
      >
        <h2 className="font-display text-2xl text-foreground">
          {state.chargedToRoom ? "Charged to your room" : "Order received"}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {state.chargedToRoom
            ? `Total ${formatGuestBtn(state.totalBtn ?? 0)} posted to room ${state.roomLabel ?? ""}. Kitchen will deliver / you can collect — check out pays the folio.`
            : `Total ${formatGuestBtn(state.totalBtn ?? 0)}. The desk will WhatsApp you a confirmation with payment details — send the transfer journal number back and the kitchen starts cooking.`}
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
      gstRate={resolvedGstRate}
      ticket={cartTicket}
      onQty={setQty}
      onClear={() => setCart({})}
      deliveryType={deliveryType}
      onDeliveryType={(v) => {
        if (v !== "room") clearRoomSession();
        setDeliveryType(v);
      }}
      deliveryArea={deliveryArea}
      onDeliveryArea={setDeliveryArea}
      roomToken={roomToken}
      roomLabel={roomLabel}
      onRoomVerified={bindRoomSession}
      onClearRoom={clearRoomSession}
      initialTableLabel={initialTableLabel}
      browseOutlet={outlet}
      state={state}
      action={action}
      pending={pending}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="min-w-0" aria-label="Menu">
        <div
          className={cn(
            "sticky z-20 border-b border-border bg-background/95 backdrop-blur",
            /* Mobile: roomy touch strips */
            "-mx-4 space-y-2.5 px-4 py-3 sm:-mx-6 sm:px-6",
            /* Desktop: ultra-thin sticky bar — maximize dish grid */
            "lg:mx-0 lg:space-y-1 lg:rounded-lg lg:border lg:px-2 lg:py-1.5 lg:shadow-sm",
            menuChrome?.hideChrome ? "top-0 lg:top-[3.25rem]" : "top-[3.75rem] lg:top-[3.25rem]",
          )}
        >
          {/* —— Desktop compact toolbar (one search + outlet row, one category row) —— */}
          <div className="hidden lg:block">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative w-[13.5rem] shrink-0 xl:w-48">
                <SearchIcon
                  aria-hidden
                  className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search menu…"
                  aria-label="Search the menu"
                  className="h-8 rounded-md border-border/80 pl-8 text-[13px]"
                />
              </div>
              <div
                className="flex min-w-0 flex-1 gap-1 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Outlets"
              >
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
                      "h-8 shrink-0 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
                      outlet === entry.id
                        ? "border-juniper bg-juniper text-white"
                        : "border-border bg-card text-foreground hover:bg-secondary",
                    )}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="mt-1 flex gap-1 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="Categories"
            >
              {categories.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setCategory(entry)}
                  aria-pressed={category === entry}
                  className={cn(
                    "h-7 shrink-0 rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                    category === entry
                      ? "bg-mist-1 text-juniper"
                      : "bg-secondary/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry === "all" ? "All" : entry}
                </button>
              ))}
            </div>
          </div>

          {/* —— Mobile stacked filters (tap-friendly) —— */}
          <div className="space-y-2.5 lg:hidden">
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
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                      ? "border-juniper bg-juniper text-white"
                      : "border-border bg-card text-foreground hover:bg-secondary",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setCategory(entry)}
                  aria-pressed={category === entry}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                    category === entry
                      ? "bg-mist-1 text-juniper"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry === "all" ? "All dishes" : entry}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-4 rounded-xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
            No dishes match that search. Try another outlet or clear the filter.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mt-3 lg:grid-cols-3 lg:gap-3 xl:grid-cols-4 2xl:grid-cols-5">
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
        <aside className="lg:sticky lg:top-[3.75rem] lg:self-start">
          {cartPanel}
        </aside>
      ) : (
        <>
          {cartCount > 0 ? (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_30px_rgba(18,26,23,0.12)] lg:hidden">
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
                  {formatGuestBtn(totals.totalBtn)} · Checkout
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
    <li
      id={`item-${item.id}`}
      className={cn(
        "media-card flex scroll-mt-40 flex-col overflow-hidden rounded-xl border bg-card",
        highlighted
          ? "border-juniper ring-2 ring-juniper/25"
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
          <span className="absolute left-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-juniper text-xs font-semibold text-white shadow-sm">
            {qty}
          </span>
        ) : null}
        {item.is_popular ? (
          <span className="absolute right-2 top-2 rounded-full bg-ember px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cedar-ink">
            Popular
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
          {item.name}
        </p>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
            {item.description}
          </p>
        ) : null}
        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {item.category}
          {item.gst_applicable ? " · +GST" : ""}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-[13px] font-semibold tabular-nums text-juniper">
            {formatBtn(item.price_btn)}
          </span>
          {item.sold_out ? (
            <span className="rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] font-semibold text-destructive">
              Sold out
            </span>
          ) : !orderable ? (
            <span className="rounded-lg border border-border bg-secondary/40 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              Desk only
            </span>
          ) : qty === 0 ? (
            <button
              type="button"
              aria-label={`Add ${item.name}`}
              onClick={onAdd}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-ember text-cedar-ink transition-colors hover:bg-ember-soft"
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
  );
}

function OrderCart({
  cartLines,
  items,
  totals,
  gstRate,
  ticket,
  onQty,
  onClear,
  deliveryType,
  onDeliveryType,
  deliveryArea,
  onDeliveryArea,
  roomToken,
  roomLabel,
  onRoomVerified,
  onClearRoom,
  initialTableLabel,
  browseOutlet,
  state,
  action,
  pending,
}: {
  cartLines: { menuItemId: string; qty: number }[];
  items: MenuItem[];
  totals: ReturnType<typeof withGuestFacingTotal>;
  gstRate: number;
  ticket: Ticket | null;
  onQty: (id: string, next: number) => void;
  onClear: () => void;
  deliveryType: "pickup" | "taxi" | "room";
  onDeliveryType: (value: "pickup" | "taxi" | "room") => void;
  deliveryArea: string;
  onDeliveryArea: (value: string) => void;
  roomToken: string | null;
  roomLabel: string | null;
  onRoomVerified: (token: string, label: string) => void;
  onClearRoom: () => void;
  initialTableLabel?: string;
  browseOutlet: OutletId;
  state: OrderActionState;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  const empty = cartLines.length === 0;
  const roomReady = deliveryType !== "room" || Boolean(roomToken && roomLabel);
  const gstPct = Math.round(gstRate * 10000) / 100;

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
      {roomToken ? (
        <input type="hidden" name="guest_room_token" value={roomToken} />
      ) : null}

      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="font-semibold text-foreground">Your order</p>
          <p className="text-xs text-muted-foreground">
            {ticket ? `${TICKET_LABEL[ticket]} ticket` : "Pickup, room, or taxi"}
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
            <span className="tabular-nums">
              {formatGuestBtn(totals.subtotalBtn)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>GST ({gstPct}%)</span>
            <span className="tabular-nums">{formatBtn(totals.gstBtn)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-semibold text-foreground">
            <span>Total</span>
            <span className="tabular-nums">
              {formatGuestBtn(totals.totalBtn)}
            </span>
          </div>
          {totals.guestAbsorbBtn < -0.009 ? (
            <p className="pt-0.5 text-xs text-muted-foreground">
              Rounded to whole Nu ending 0 or 5
            </p>
          ) : null}
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
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["pickup", "Pickup"],
                ["room", "My room"],
                ["taxi", "Taxi"],
              ] as const
            ).map(([option, label]) => (
              <label
                key={option}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-1 text-center text-xs font-medium transition-colors sm:text-sm",
                  deliveryType === option
                    ? "border-juniper bg-mist-1 text-juniper"
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
                {label}
              </label>
            ))}
          </div>

          {deliveryType === "room" ? (
            <RoomVerifyPanel
              roomToken={roomToken}
              roomLabel={roomLabel}
              onVerified={onRoomVerified}
              onClear={onClearRoom}
            />
          ) : null}

          {deliveryType !== "room" ? (
            <>
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
            </>
          ) : null}

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
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={
                initialTableLabel
                  ? `Table ${initialTableLabel}`
                  : undefined
              }
              placeholder={
                initialTableLabel
                  ? `Table ${initialTableLabel} · allergies, spice…`
                  : "Allergies, spice, timing…"
              }
            />
            {browseOutlet === "bar" ? (
              <p className="text-xs text-amber-800">
                Bar drinks are order-at-desk only — browser filter shows them to
                browse; cart checkout is not available for bar items.
              </p>
            ) : null}
          </div>
        </fieldset>
      </div>

      <div className="border-t border-border p-4">
        <Button
          type="submit"
          variant="citrus"
          className="h-12 w-full text-[15px]"
          disabled={pending || empty || !roomReady}
        >
          {pending
            ? "Placing…"
            : empty
              ? "Add items to order"
              : !roomReady
                ? "Verify room first"
                : deliveryType === "room"
                  ? `Charge room · ${formatGuestBtn(totals.totalBtn)}`
                  : `Place order · ${formatGuestBtn(totals.totalBtn)}`}
        </Button>
      </div>
    </form>
  );
}

const verifyInitial: VerifyGuestRoomState = { ok: false };

function RoomVerifyPanel({
  roomToken,
  roomLabel,
  onVerified,
  onClear,
}: {
  roomToken: string | null;
  roomLabel: string | null;
  onVerified: (token: string, label: string) => void;
  onClear: () => void;
}) {
  const [rooms, setRooms] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [phone, setPhone] = useState("");
  const [state, action, pending] = useActionState(
    verifyGuestRoomForOrder,
    verifyInitial,
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingRooms(true);
    fetchInHouseRoomLabels()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setRooms(res.rooms ?? []);
          setLoadError(null);
        } else {
          setLoadError(res.error ?? "Could not load rooms.");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load rooms.");
      })
      .finally(() => {
        if (!cancelled) setLoadingRooms(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.ok && state.token && state.roomLabel) {
      onVerified(state.token, state.roomLabel);
    }
  }, [state.ok, state.token, state.roomLabel, onVerified]);

  if (roomToken && roomLabel) {
    return (
      <div className="rounded-xl border border-mint-100 bg-mist-1/40 px-3 py-3 text-sm">
        <p className="font-medium text-foreground">
          In-house · Room {roomLabel}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Verified with the mobile number on your stay. Order charges this room’s
          folio. No guest names are shown publicly.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="mt-2 text-xs font-medium text-juniper underline-offset-4 hover:underline"
        >
          Use a different room
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Checked-in guests only. We list room numbers — never names. Confirm with
        the mobile number used at check-in.
      </p>
      {loadingRooms ? (
        <p className="text-xs text-muted-foreground">Loading rooms…</p>
      ) : loadError ? (
        <p className="text-xs text-destructive" role="alert">
          {loadError}
        </p>
      ) : rooms.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No rooms available for charge right now. Use pickup or call the desk.
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="room_label">Your room number</Label>
            <select
              id="room_label"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              required
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Select room…
              </option>
              {rooms.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="verify-phone">Mobile on booking</Label>
            <Input
              id="verify-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              placeholder="+975 …"
              maxLength={24}
              className="h-11"
            />
          </div>
          {state.error ? (
            <p className="text-xs text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={pending || !selectedRoom || !phone.trim()}
            className="h-10 w-full"
            onClick={() => {
              const fd = new FormData();
              fd.set("room_label", selectedRoom);
              fd.set("phone", phone.trim());
              action(fd);
            }}
          >
            {pending ? "Checking…" : "Verify room"}
          </Button>
        </div>
      )}
    </div>
  );
}
