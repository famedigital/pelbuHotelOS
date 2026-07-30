"use client";

import { createOrder, type OrderActionState } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { THIMPHU_DELIVERY_AREAS } from "@/lib/delivery-areas";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { MenuItem } from "@/lib/menu";
import { BHUTAN_GST_RATE, calculateOrderTotals, formatBtn } from "@/lib/pricing";
import {
  MinusIcon,
  PlusIcon,
  SearchIcon,
  ShoppingBagIcon,
} from "lucide-react";
import { useActionState, useMemo, useState } from "react";

const initial: OrderActionState = { ok: false };
type CartMap = Record<string, number>;
type MenuGroup = "cafe" | "restaurant";

function menuGroup(item: MenuItem): MenuGroup {
  return item.outlet === "restaurant" ? "restaurant" : "cafe";
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
    <Button type="button" variant="outline" size="sm" onClick={onCopy}>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function OrderForm({ items }: { items: MenuItem[] }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [cart, setCart] = useState<CartMap>({});
  const [deliveryType, setDeliveryType] = useState<"pickup" | "taxi">("pickup");
  const [deliveryArea, setDeliveryArea] = useState<string>("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeMenu, setActiveMenu] = useState<MenuGroup>(() =>
    items.some((item) => menuGroup(item) === "cafe") ? "cafe" : "restaurant",
  );
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
    const normalizedQuery = query.trim().toLowerCase();
    const visibleItems = items.filter((item) => {
      if (menuGroup(item) !== activeMenu) return false;
      if (
        normalizedQuery &&
        !`${item.name} ${item.description ?? ""} ${item.category}`
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }
      return activeCategory === "all" || item.category === activeCategory;
    });
    for (const item of visibleItems) {
      const key = `${item.outlet} · ${item.category}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [activeCategory, activeMenu, items, query]);

  const categories = useMemo(
    () => [
      ...new Set(
        items
          .filter((item) => menuGroup(item) === activeMenu)
          .map((item) => item.category),
      ),
    ],
    [activeMenu, items],
  );

  const availableMenus = useMemo(
    () => new Set(items.map((item) => menuGroup(item))),
    [items],
  );

  function switchMenu(next: MenuGroup) {
    if (next === activeMenu) return;
    setActiveMenu(next);
    setActiveCategory("all");
    setQuery("");
    if (Object.keys(cart).length > 0) {
      setCart({});
      setMobileCartOpen(false);
    }
  }

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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 space-y-8" aria-label="Menu">
        <div className="sticky top-16 z-10 -mx-5 space-y-3 border-b border-border bg-background/95 px-5 pb-4 pt-1 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0">
          {availableMenus.size > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              <CategoryButton
                active={activeMenu === "cafe"}
                onClick={() => switchMenu("cafe")}
              >
                Cafe & pastry
              </CategoryButton>
              <CategoryButton
                active={activeMenu === "restaurant"}
                onClick={() => switchMenu("restaurant")}
              >
                Restaurant
              </CategoryButton>
            </div>
          ) : null}
          {Object.keys(cart).length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Cafe and restaurant produce separate kitchen tickets. Changing
              menus clears this cart.
            </p>
          ) : null}
          <div className="relative">
            <SearchIcon
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search today’s menu"
              aria-label="Search menu"
              className="h-11 pl-10"
            />
          </div>
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            aria-label="Menu categories"
          >
            <CategoryButton
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            >
              All
            </CategoryButton>
            {categories.map((category) => (
              <CategoryButton
                key={category}
                active={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </CategoryButton>
            ))}
          </div>
        </div>

        {byCategory.length === 0 ? (
          <p className="rounded-xl border border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No menu items match that search.
          </p>
        ) : null}
        {byCategory.map(([category, categoryItems]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold text-ink">{category}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {categoryItems.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <li
                    key={item.id}
                    className="relative flex min-h-40 overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <div className="flex min-w-0 flex-1 flex-col p-4">
                      <div className="flex items-start gap-2">
                        <p className="text-[15px] font-medium text-ink">
                          {item.name}
                        </p>
                        {item.is_popular ? (
                          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                            Popular
                          </span>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-auto pt-3 text-sm font-medium tabular-nums text-ink">
                        {formatBtn(item.price_btn)}
                        {item.gst_applicable ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            +GST
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name}`}
                        disabled={qty === 0}
                        onClick={() => setQty(item.id, qty - 1)}
                          className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-ink disabled:opacity-40"
                      >
                          <MinusIcon className="size-4" />
                      </button>
                        <span className="w-8 text-center font-mono text-sm tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name}`}
                        onClick={() => setQty(item.id, qty + 1)}
                          className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-primary text-primary-foreground"
                      >
                          <PlusIcon className="size-4" />
                      </button>
                      </div>
                    </div>
                    {item.image_src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_src}
                        alt=""
                        width={180}
                        height={180}
                        loading="lazy"
                        className="h-full w-28 shrink-0 object-cover sm:w-32"
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {isDesktop ? (
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CartPanel
            cartPayload={cartPayload}
            items={items}
            totals={totals}
            deliveryType={deliveryType}
            onDeliveryType={setDeliveryType}
            deliveryArea={deliveryArea}
            onDeliveryArea={setDeliveryArea}
            state={state}
            action={action}
            pending={pending}
          />
        </aside>
      ) : null}

      {showStickyBar ? (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.08)] lg:hidden">
          <button
            type="button"
            onClick={() => setMobileCartOpen((v) => !v)}
            className="flex min-h-14 w-full items-center justify-between px-5 py-3 text-left"
            aria-expanded={mobileCartOpen}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <ShoppingBagIcon className="size-4" />
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
                deliveryArea={deliveryArea}
                onDeliveryArea={setDeliveryArea}
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

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "min-h-11 shrink-0 rounded-xl border px-4 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-ink hover:border-primary/40",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CartPanel({
  cartPayload,
  items,
  totals,
  deliveryType,
  onDeliveryType,
  deliveryArea,
  onDeliveryArea,
  state,
  action,
  pending,
}: {
  cartPayload: { menuItemId: string; qty: number }[];
  items: MenuItem[];
  totals: ReturnType<typeof calculateOrderTotals>;
  deliveryType: "pickup" | "taxi";
  onDeliveryType: (v: "pickup" | "taxi") => void;
  deliveryArea: string;
  onDeliveryArea: (v: string) => void;
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
          <>
            <div className="grid gap-2">
              <Label htmlFor="delivery-area">Thimphu area</Label>
              <select
                id="delivery-area"
                name="delivery_area"
                required
                value={deliveryArea}
                onChange={(e) => onDeliveryArea(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Choose area…</option>
                {THIMPHU_DELIVERY_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Taxi delivery is Thimphu only. Pickup is free — collect at the
                cafe counter.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="delivery-address">Landmark / detail address</Label>
              <Textarea
                id="delivery-address"
                name="delivery_address"
                required
                rows={2}
                maxLength={400}
                placeholder="Building colour, floor, what3words, gate detail…"
              />
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="delivery_area" value="" />
            <input type="hidden" name="delivery_address" value="" />
          </>
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
