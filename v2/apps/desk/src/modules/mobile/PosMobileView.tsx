import { Drawer } from "vaul";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, EmptyState } from "@hos-v2/ui";
import { MoreHorizontal } from "lucide-react";
import {
  CATEGORIES,
  formatNu,
  getCartTotals,
  useFnbStore,
} from "../../lib/fnb-store";
import { useFrontOfficeStore } from "../../lib/front-office-store";
import { TipPoolWidget } from "./TipPoolWidget";

/** Phone POS — menu owns the screen; tables / tip / room charge live in sheets. */
export function PosMobileView() {
  const reduce = useReducedMotion();
  const [roomQuery, setRoomQuery] = useState("");
  const [tablesOpen, setTablesOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const tables = useFnbStore((s) => s.tables);
  const tableLabel = useFnbStore((s) => s.tableLabel);
  const selectTable = useFnbStore((s) => s.selectTable);
  const category = useFnbStore((s) => s.category);
  const setCategory = useFnbStore((s) => s.setCategory);
  const menu = useFnbStore((s) => s.menu);
  const cart = useFnbStore((s) => s.cart);
  const addToCart = useFnbStore((s) => s.addToCart);
  const bumpQty = useFnbStore((s) => s.bumpQty);
  const fireKot = useFnbStore((s) => s.fireKot);
  const settle = useFnbStore((s) => s.settle);
  const setSelectedStayId = useFnbStore((s) => s.setSelectedStayId);
  const selectedStayId = useFnbStore((s) => s.selectedStayId);
  const shift = useFnbStore((s) => s.shift);
  const openShift = useFnbStore((s) => s.openShift);
  const hydrateCatalog = useFnbStore((s) => s.hydrateCatalog);

  useEffect(() => {
    void hydrateCatalog();
  }, [hydrateCatalog]);

  const stays = useFrontOfficeStore((s) => s.stays);
  const inHouse = stays.filter((s) => s.status === "checked_in");

  const filteredMenu = useMemo(
    () => menu.filter((m) => m.category === category),
    [menu, category],
  );

  const roomHits = useMemo(() => {
    const q = roomQuery.trim().toLowerCase();
    if (!q) return inHouse.slice(0, 6);
    return inHouse
      .filter(
        (s) =>
          (s.roomNumber ?? "").includes(q) ||
          s.guestName.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [inHouse, roomQuery]);

  const totals = getCartTotals(cart);
  const cartLine = (menuItemId: string) =>
    cart.find((c) => c.menuItemId === menuItemId && !c.note);
  const lineCount = cart.reduce((n, c) => n + c.qty, 0);
  const shiftOpen = shift?.status === "open";

  return (
    <div className="hos-mobile-page !gap-1.5 !overflow-hidden">
      {/* Compact top strip */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setTablesOpen(true)}
          className="hos-btn-tactile flex min-h-11 min-w-0 flex-1 items-center justify-between rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 text-left"
        >
          <span className="truncate text-[13px] font-bold text-[var(--hos-ink)]">
            {tableLabel ? `Table ${tableLabel}` : "Pick table"}
          </span>
          <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
            Change
          </span>
        </button>
        {shiftOpen ? (
          <Badge tone="success" className="shrink-0 !px-2.5 !py-2 text-[11px]">
            Live
          </Badge>
        ) : (
          <Button
            size="sm"
            className="hos-btn-ink shrink-0 !min-h-11 !rounded-xl !px-3 text-[12px] font-bold"
            onClick={() => {
              void openShift(5000).then((res) => {
                if (!res.ok) {
                  toast.error("Could not open shift", { description: res.error });
                  return;
                }
                toast.success(res.offline ? "Shift open offline" : "Shift opened");
              });
            }}
          >
            Open
          </Button>
        )}
        <button
          type="button"
          aria-label="More"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink)]"
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal className="size-5" strokeWidth={2.25} />
        </button>
      </div>

      {/* Categories */}
      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={[
              "min-h-10 shrink-0 rounded-full px-3.5 text-[13px] font-bold",
              category === c.id
                ? "bg-[#111] text-white"
                : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]",
            ].join(" ")}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Menu owns the screen */}
      <AnimatePresence mode="wait">
        <motion.div
          key={category}
          className="hos-scrollbar-slim min-h-0 flex-1 overflow-y-auto pb-[calc(5.5rem+var(--mobile-dock-clearance))]"
          initial={reduce ? false : { opacity: 0.6 }}
          animate={{ opacity: 1 }}
        >
          {!shiftOpen ? (
            <EmptyState
              title="Shift closed"
              description="Open a shift to ring menu items."
              action={
                <Button
                  size="sm"
                  className="hos-btn-ink"
                  onClick={() => {
                    void openShift(5000).then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Shift opened");
                    });
                  }}
                >
                  Open shift
                </Button>
              }
            />
          ) : filteredMenu.length === 0 ? (
            <EmptyState title="No items" description="Pick another category." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filteredMenu.map((item) => {
                const line = cartLine(item.id);
                const qty = line?.qty ?? 0;
                return (
                  <div
                    key={item.id}
                    className={[
                      "relative flex min-h-[7.5rem] flex-col rounded-2xl border p-2.5",
                      qty > 0
                        ? "border-[#111] bg-[#111] text-white"
                        : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink)]",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      disabled={!shiftOpen}
                      className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 text-center"
                      onClick={() => addToCart(item.id)}
                    >
                      <span className="text-2xl leading-none">{item.emoji}</span>
                      <strong className="line-clamp-2 text-[13px] font-bold leading-tight">
                        {item.name}
                      </strong>
                      <span
                        className={[
                          "font-mono text-[12px] font-bold tabular-nums",
                          qty > 0 ? "text-white/85" : "text-[var(--hos-ink-2)]",
                        ].join(" ")}
                      >
                        {formatNu(item.netPrice)}
                      </span>
                    </button>
                    {qty > 0 ? (
                      <div className="mt-1 flex w-full items-center justify-center gap-1.5">
                        <button
                          type="button"
                          className="flex size-10 items-center justify-center rounded-full bg-white/15 text-[18px] font-bold"
                          onClick={() => line && bumpQty(line.key, -1)}
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <span className="w-7 text-center font-mono text-[14px] font-black tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          className="flex size-10 items-center justify-center rounded-full bg-white text-[18px] font-bold text-[#111]"
                          onClick={() => addToCart(item.id)}
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Sticky cart bar */}
      <div className="fixed inset-x-0 bottom-[var(--mobile-dock-clearance)] z-30 border-t border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] md:hidden">
        <div className="mb-1.5 flex items-center justify-between px-0.5 text-[12px]">
          <span className="font-semibold text-[var(--hos-ink-2)]">
            {lineCount} items
          </span>
          <strong className="font-mono text-[14px] font-black tabular-nums text-[var(--hos-ink)]">
            {formatNu(totals.total)}
          </strong>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="hos-btn-ink !min-h-12 !rounded-xl text-[14px] font-bold"
            disabled={cart.length === 0 || !shiftOpen}
            onClick={() => {
              void fireKot().then((res) => {
                if (!res.ok) toast.error(res.error);
                else
                  toast.success("KOT fired", {
                    description: res.kotIds.join(", "),
                  });
              });
            }}
          >
            Fire KOT
          </Button>
          <Button
            variant="secondary"
            className="!min-h-12 !rounded-xl border border-[var(--hos-line)] text-[14px] font-bold"
            disabled={cart.length === 0}
            onClick={() => setCartOpen(true)}
          >
            Cart
          </Button>
        </div>
      </div>

      {/* Tables sheet */}
      <Drawer.Root open={tablesOpen} onOpenChange={setTablesOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[70dvh] flex-col rounded-t-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] outline-none">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15" />
            <Drawer.Title className="px-4 py-3 text-[16px] font-black text-[var(--hos-ink)]">
              Tables
            </Drawer.Title>
            <div className="grid grid-cols-4 gap-2 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    selectTable(t.label);
                    setTablesOpen(false);
                  }}
                  className={[
                    "min-h-14 rounded-xl text-[14px] font-bold",
                    tableLabel === t.label
                      ? "bg-[#111] text-white"
                      : "border border-[var(--hos-line)] bg-[var(--hos-canvas-2)] text-[var(--hos-ink)]",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Cart / settle sheet */}
      <Drawer.Root open={cartOpen} onOpenChange={setCartOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[85dvh] flex-col rounded-t-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] outline-none">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15" />
            <Drawer.Title className="px-4 py-3 text-[16px] font-black text-[var(--hos-ink)]">
              Cart · {formatNu(totals.total)}
            </Drawer.Title>
            <div className="hos-scrollbar-slim min-h-0 flex-1 space-y-2 overflow-y-auto px-4">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[var(--hos-ink-2)]">
                  Cart empty
                </p>
              ) : (
                cart.map((line) => {
                  const item = menu.find((m) => m.id === line.menuItemId);
                  return (
                    <div
                      key={line.key}
                      className="flex items-center gap-2 rounded-xl border border-[var(--hos-line)] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-[var(--hos-ink)]">
                          {item?.name ?? line.menuItemId}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--hos-ink-2)]">
                          {formatNu(item?.netPrice ?? 0)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="size-10 rounded-full bg-[var(--hos-canvas-2)] text-[16px] font-bold"
                        onClick={() => bumpQty(line.key, -1)}
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-mono text-[13px] font-black">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        className="size-10 rounded-full bg-[#111] text-[16px] font-bold text-white"
                        onClick={() => bumpQty(line.key, 1)}
                      >
                        +
                      </button>
                    </div>
                  );
                })
              )}

              <div className="pt-2">
                <strong className="text-[12px] font-black uppercase tracking-wide text-[var(--hos-ink-2)]">
                  Room charge
                </strong>
                <input
                  value={roomQuery}
                  onChange={(e) => setRoomQuery(e.target.value)}
                  placeholder="Rm # or guest"
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--hos-line)] bg-[var(--hos-canvas-2)] px-3 text-[15px] font-semibold text-[var(--hos-ink)] outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {roomHits.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStayId(s.id)}
                      className={[
                        "min-h-10 rounded-full px-3 text-[12px] font-bold",
                        selectedStayId === s.id
                          ? "bg-[var(--hos-primary)] text-white"
                          : "bg-[var(--hos-canvas-2)] text-[var(--hos-ink)]",
                      ].join(" ")}
                    >
                      Rm {s.roomNumber}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-[var(--hos-line)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button
                className="hos-btn-ink !min-h-12 !rounded-xl font-bold"
                disabled={cart.length === 0 || !shiftOpen}
                onClick={() => {
                  void fireKot().then((res) => {
                    if (!res.ok) toast.error(res.error);
                    else toast.success("KOT fired");
                  });
                }}
              >
                Fire KOT
              </Button>
              <Button
                variant="secondary"
                className="!min-h-12 !rounded-xl font-bold"
                disabled={cart.length === 0 || !selectedStayId || !shiftOpen}
                onClick={() => {
                  void settle("room_charge").then((res) => {
                    if (!res.ok) toast.error(res.error);
                    else {
                      toast.success("Room charged", { description: res.billNo });
                      setCartOpen(false);
                    }
                  });
                }}
              >
                Room charge
              </Button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* More sheet */}
      <Drawer.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[60dvh] flex-col rounded-t-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] outline-none">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15" />
            <Drawer.Title className="px-4 py-3 text-[16px] font-black text-[var(--hos-ink)]">
              POS tools
            </Drawer.Title>
            <div className="space-y-3 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <TipPoolWidget />
              <Link
                to="/kds"
                className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-canvas-2)] text-[14px] font-bold text-[var(--hos-ink)]"
                onClick={() => setMoreOpen(false)}
              >
                Kitchen Pass (KDS)
              </Link>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
