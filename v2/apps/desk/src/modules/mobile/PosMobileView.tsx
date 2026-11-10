import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  butterCard,
  springButter,
  springPress,
  springSoft,
  staggerButter,
} from "@hos-v2/ui";
import {
  CATEGORIES,
  formatNu,
  getCartTotals,
  useFnbStore,
} from "../../lib/fnb-store";
import { useFrontOfficeStore } from "../../lib/front-office-store";
import { TipPoolWidget } from "./TipPoolWidget";

/** Phone POS — table grid, category pills, steppers, Fire KOT. */
export function PosMobileView() {
  const reduce = useReducedMotion();
  const [roomQuery, setRoomQuery] = useState("");
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
    if (!q) return inHouse.slice(0, 4);
    return inHouse
      .filter(
        (s) =>
          (s.roomNumber ?? "").includes(q) ||
          s.guestName.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [inHouse, roomQuery]);

  const totals = getCartTotals(cart);
  const cartLine = (menuItemId: string) =>
    cart.find((c) => c.menuItemId === menuItemId && !c.note);
  const lineCount = cart.reduce((n, c) => n + c.qty, 0);

  return (
    <div className="hos-mobile-page">
      <motion.div
        className="hos-mobile-hero"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
      >
        <div>
          <h1 className="hos-mobile-hero-title">Waiter POS</h1>
          <p className="hos-mobile-hero-meta">
            {tableLabel ? `Table ${tableLabel}` : "Pick a table"} ·{" "}
            {shift?.status === "open" ? "Shift open" : "Shift closed"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={shift?.status === "open" ? "success" : "muted"}>
            {shift?.status === "open" ? "Live" : "Closed"}
          </Badge>
          {shift?.status !== "open" ? (
            <Button
              size="sm"
              className="hos-btn-ink !min-h-12 !rounded-xl"
              onClick={() => {
                void openShift(5000).then((res) => {
                  if (!res.ok) {
                    toast.error("Could not open shift", {
                      description: res.error,
                    });
                    return;
                  }
                  toast.success(
                    res.offline ? "Shift open offline" : "Shift opened",
                    { description: "Opening float Nu. 5,000" },
                  );
                });
              }}
            >
              Open
            </Button>
          ) : null}
        </div>
      </motion.div>

      <TipPoolWidget />

      <motion.div
        className="grid grid-cols-4 gap-2"
        variants={reduce ? undefined : staggerButter}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        {tables.slice(0, 12).map((t) => (
          <motion.button
            key={t.id}
            type="button"
            variants={reduce ? undefined : butterCard}
            whileTap={reduce ? undefined : { scale: 0.94, transition: springPress }}
            onClick={() => selectTable(t.label)}
            className={[
              "relative min-h-12 rounded-[12px] text-[13px] font-bold",
              tableLabel === t.label
                ? "bg-[#111] text-white shadow-[0_8px_20px_-10px_#111]"
                : t.status === "seated"
                  ? "bg-[rgba(255,149,0,0.18)] text-[var(--hos-ink)]"
                  : "hos-pos-tile !aspect-auto !min-h-14 !rounded-[12px] text-[var(--hos-ink-2)]",
            ].join(" ")}
          >
            {tableLabel === t.label && !reduce ? (
              <motion.span
                layoutId="posTableGlow"
                className="pointer-events-none absolute inset-0 rounded-[12px] ring-2 ring-white/20"
                transition={springButter}
              />
            ) : null}
            <span className="relative z-10">{t.label}</span>
          </motion.button>
        ))}
      </motion.div>

      <motion.div
        className="hos-glass-card hos-butter-card flex flex-col gap-2 p-3"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSoft, delay: 0.05 }}
      >
        <strong className="text-[13px] text-[var(--hos-ink)]">
          Post to guest room
        </strong>
        <input
          value={roomQuery}
          onChange={(e) => setRoomQuery(e.target.value)}
          placeholder="Rm # or guest name"
          className="min-h-11 rounded-[10px] border-0 bg-[var(--hos-canvas-2)] px-3 text-[16px] outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {roomHits.map((s) => (
            <motion.button
              key={s.id}
              type="button"
              whileTap={reduce ? undefined : { scale: 0.95 }}
              onClick={() => {
                setSelectedStayId(s.id);
                toast.message(`Charging Rm ${s.roomNumber}`, {
                  description: s.guestName,
                });
              }}
              className={[
                "min-h-10 rounded-full px-3 text-[12px] font-semibold",
                selectedStayId === s.id
                  ? "bg-[var(--hos-primary)] text-white"
                  : "bg-[var(--hos-canvas-2)] text-[var(--hos-ink)]",
              ].join(" ")}
            >
              Rm {s.roomNumber} · {s.guestName.split(" ")[0]}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => (
          <motion.button
            key={c.id}
            type="button"
            whileTap={reduce ? undefined : { scale: 0.94 }}
            onClick={() => setCategory(c.id)}
            className={[
              "relative min-h-10 shrink-0 overflow-hidden rounded-full px-3.5 text-[13px] font-semibold",
              category === c.id
                ? "text-white"
                : "bg-[var(--hos-cell)] text-[var(--hos-ink-2)] shadow-[var(--hos-card-shadow)]",
            ].join(" ")}
          >
            {category === c.id ? (
              <motion.span
                layoutId="posCatPill"
                className="absolute inset-0 rounded-full bg-[#111]"
                transition={reduce ? { duration: 0 } : springButter}
              />
            ) : null}
            <span className="relative z-10">{c.label}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={category}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-20"
          variants={reduce ? undefined : staggerButter}
          initial={reduce ? false : "hidden"}
          animate="show"
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
        >
          {filteredMenu.length === 0 ? (
            <EmptyState title="No items" description="Pick another category." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filteredMenu.map((item) => {
                const line = cartLine(item.id);
                const qty = line?.qty ?? 0;
                return (
                  <motion.div
                    key={item.id}
                    variants={reduce ? undefined : butterCard}
                    layout
                    className="hos-pos-tile relative !justify-between gap-2 p-2.5"
                    data-active={qty > 0 ? "true" : undefined}
                  >
                    <button
                      type="button"
                      className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 text-center"
                      onClick={() => addToCart(item.id)}
                    >
                      <span className="text-2xl leading-none">{item.emoji}</span>
                      <strong className="line-clamp-2 text-[12px] font-bold leading-tight">
                        {item.name}
                      </strong>
                      <span className="font-mono text-[11px] tabular-nums opacity-80">
                        {formatNu(item.netPrice)}
                      </span>
                    </button>
                    <div className="flex w-full items-center justify-center gap-1">
                      <motion.button
                        type="button"
                        whileTap={reduce ? undefined : { scale: 0.88 }}
                        className="flex size-9 items-center justify-center rounded-full bg-[rgba(0,0,0,0.06)] text-[16px] font-bold"
                        onClick={() => {
                          if (line) bumpQty(line.key, -1);
                        }}
                        aria-label="Decrease"
                      >
                        −
                      </motion.button>
                      <motion.span
                        key={qty}
                        initial={reduce ? false : { scale: 1.2, opacity: 0.5 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-6 text-center font-mono text-[13px] font-bold tabular-nums"
                      >
                        {qty}
                      </motion.span>
                      <motion.button
                        type="button"
                        whileTap={reduce ? undefined : { scale: 0.88 }}
                        className="flex size-9 items-center justify-center rounded-full bg-[#111] text-[16px] font-bold text-white"
                        onClick={() => addToCart(item.id)}
                        aria-label="Increase"
                      >
                        +
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <motion.div
        className="fixed inset-x-0 bottom-[calc(var(--mobile-dock-height)+env(safe-area-inset-bottom,0px))] z-30 border-t border-[var(--hos-line)] bg-[var(--hos-surface)] p-3 backdrop-blur-xl md:hidden"
        initial={reduce ? false : { y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springButter}
      >
        <div className="mb-2 flex items-center justify-between text-[13px]">
          <span className="text-[var(--hos-ink-3)]">
            <motion.span
              key={lineCount}
              initial={reduce ? false : { y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="inline-block"
            >
              {lineCount} lines
            </motion.span>
          </span>
          <strong className="font-mono tabular-nums text-[var(--hos-ink)]">
            {formatNu(totals.total)}
          </strong>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            magnetic
            className="hos-btn-ink hos-btn-spring !min-h-12 !min-w-[48px] !rounded-[14px] text-[15px] font-bold"
            disabled={cart.length === 0}
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
            magnetic
            className="hos-btn-tactile !min-h-12 !min-w-[48px] !rounded-[14px] text-[15px] font-bold"
            disabled={cart.length === 0 || !selectedStayId}
            onClick={() => {
              void settle("room_charge").then((res) => {
                if (!res.ok) toast.error(res.error);
                else
                  toast.success("Room charged", {
                    description: res.billNo,
                  });
              });
            }}
          >
            Room charge
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
