import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, EmptyState } from "@hos-v2/ui";
import {
  CATEGORIES,
  formatNu,
  getCartTotals,
  useFnbStore,
} from "../../lib/fnb-store";
import { useFrontOfficeStore } from "../../lib/front-office-store";

/**
 * Tablet POS (768–1023) — menu ~70% | cart rail ~30%.
 * No ModuleFrame fat chrome; tip/room waste stays off the permanent stack.
 */
export function PosTabletView() {
  const reduce = useReducedMotion();
  const [roomQuery, setRoomQuery] = useState("");
  const [settleMode, setSettleMode] = useState<"none" | "room">("none");

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
    if (!q) return inHouse.slice(0, 8);
    return inHouse
      .filter(
        (s) =>
          (s.roomNumber ?? "").includes(q) ||
          s.guestName.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [inHouse, roomQuery]);

  const totals = getCartTotals(cart);
  const cartLine = (menuItemId: string) =>
    cart.find((c) => c.menuItemId === menuItemId && !c.note);
  const lineCount = cart.reduce((n, c) => n + c.qty, 0);
  const shiftOpen = shift?.status === "open";

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      {/* Thin status row */}
      <div className="flex shrink-0 items-center gap-2">
        <strong className="text-[15px] font-black text-[var(--hos-ink)]">
          POS
        </strong>
        <span className="text-[13px] font-semibold text-[var(--hos-ink-2)]">
          {tableLabel} · {lineCount} · {formatNu(totals.total)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {shiftOpen ? (
            <Badge tone="success">Shift open</Badge>
          ) : (
            <Button
              size="sm"
              className="hos-btn-ink !min-h-10"
              onClick={() => {
                void openShift(5000).then((res) => {
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Shift opened");
                });
              }}
            >
              Open shift
            </Button>
          )}
          <Link
            to="/kds"
            className="text-[12px] font-bold text-[var(--hos-primary)] underline-offset-2 hover:underline"
          >
            KDS →
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] gap-2">
        {/* Menu 70% */}
        <section className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
          <div className="flex shrink-0 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={[
                  "min-h-11 shrink-0 rounded-full px-4 text-[13px] font-bold",
                  category === c.id
                    ? "bg-[#111] text-white"
                    : "border border-[var(--hos-line)] bg-[var(--hos-canvas-2)] text-[var(--hos-ink-2)]",
                ].join(" ")}
              >
                {c.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={category}
              className="hos-scrollbar-slim min-h-0 flex-1 overflow-y-auto"
              initial={reduce ? false : { opacity: 0.65 }}
              animate={{ opacity: 1 }}
            >
              {!shiftOpen ? (
                <EmptyState
                  title="Shift closed"
                  description="Open a shift to ring items."
                />
              ) : filteredMenu.length === 0 ? (
                <EmptyState title="No items" description="Pick another category." />
              ) : (
                <div className="grid grid-cols-3 gap-2 xl:grid-cols-4">
                  {filteredMenu.map((item) => {
                    const line = cartLine(item.id);
                    const qty = line?.qty ?? 0;
                    return (
                      <div
                        key={item.id}
                        className={[
                          "relative flex min-h-[6.75rem] flex-col rounded-2xl border p-2",
                          qty > 0
                            ? "border-[#111] bg-[#111] text-white"
                            : "border-[var(--hos-line)] bg-[var(--hos-canvas-2)] text-[var(--hos-ink)]",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          disabled={!shiftOpen}
                          className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-0.5 text-center"
                          onClick={() => addToCart(item.id)}
                        >
                          <span className="text-xl leading-none">{item.emoji}</span>
                          <strong className="line-clamp-2 text-[12px] font-bold leading-tight">
                            {item.name}
                          </strong>
                          <span
                            className={[
                              "font-mono text-[11px] font-bold tabular-nums",
                              qty > 0 ? "text-white/85" : "text-[var(--hos-ink-2)]",
                            ].join(" ")}
                          >
                            {formatNu(item.netPrice)}
                          </span>
                        </button>
                        {qty > 0 ? (
                          <div className="mt-1 flex w-full items-center justify-center gap-1">
                            <button
                              type="button"
                              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-[16px] font-bold"
                              onClick={() => line && bumpQty(line.key, -1)}
                            >
                              −
                            </button>
                            <span className="w-6 text-center font-mono text-[13px] font-black">
                              {qty}
                            </span>
                            <button
                              type="button"
                              className="flex size-9 items-center justify-center rounded-full bg-white text-[16px] font-bold text-[#111]"
                              onClick={() => addToCart(item.id)}
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
        </section>

        {/* Cart rail 30% */}
        <aside className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
          <div className="-mx-0.5 flex shrink-0 gap-1.5 overflow-x-auto px-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTable(t.label)}
                className={[
                  "min-h-10 shrink-0 rounded-xl px-3 text-[13px] font-bold",
                  tableLabel === t.label
                    ? "bg-[#111] text-white"
                    : "border border-[var(--hos-line)] bg-[var(--hos-canvas-2)] text-[var(--hos-ink)]",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="hos-scrollbar-slim min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-[var(--hos-ink-2)]">
                Tap menu to add
              </p>
            ) : (
              cart.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-canvas-2)] px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-[var(--hos-ink)]">
                      {line.name}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--hos-ink-2)]">
                      {formatNu(line.netUnit)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="size-9 rounded-full bg-white text-[15px] font-bold text-[var(--hos-ink)]"
                    onClick={() => bumpQty(line.key, -1)}
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-mono text-[12px] font-black">
                    {line.qty}
                  </span>
                  <button
                    type="button"
                    className="size-9 rounded-full bg-[#111] text-[15px] font-bold text-white"
                    onClick={() => bumpQty(line.key, 1)}
                  >
                    +
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 space-y-2 border-t border-[var(--hos-line)] pt-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[12px] font-semibold text-[var(--hos-ink-2)]">
                Total
              </span>
              <strong className="font-mono text-[16px] font-black tabular-nums text-[var(--hos-ink)]">
                {formatNu(totals.total)}
              </strong>
            </div>

            {settleMode === "room" ? (
              <div className="space-y-1.5 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-canvas-2)] p-2">
                <input
                  value={roomQuery}
                  onChange={(e) => setRoomQuery(e.target.value)}
                  placeholder="Rm # or guest"
                  className="min-h-10 w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 text-[13px] font-semibold outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {roomHits.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStayId(s.id)}
                      className={[
                        "min-h-9 rounded-full px-2.5 text-[11px] font-bold",
                        selectedStayId === s.id
                          ? "bg-[var(--hos-primary)] text-white"
                          : "bg-[var(--hos-cell)] text-[var(--hos-ink)]",
                      ].join(" ")}
                    >
                      Rm {s.roomNumber}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="!min-h-10"
                    onClick={() => setSettleMode("none")}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="hos-btn-ink !min-h-10"
                    disabled={!selectedStayId || cart.length === 0 || !shiftOpen}
                    onClick={() => {
                      void settle("room_charge").then((res) => {
                        if (!res.ok) toast.error(res.error);
                        else {
                          toast.success("Room charged", {
                            description: res.billNo,
                          });
                          setSettleMode("none");
                        }
                      });
                    }}
                  >
                    Post
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                className="hos-btn-ink !min-h-12 !rounded-xl text-[13px] font-bold"
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
                className="!min-h-12 !rounded-xl border border-[var(--hos-line)] text-[13px] font-bold"
                disabled={cart.length === 0 || !shiftOpen}
                onClick={() => setSettleMode("room")}
              >
                Room charge
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
