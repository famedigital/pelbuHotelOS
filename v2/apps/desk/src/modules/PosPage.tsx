import * as Dialog from "@radix-ui/react-dialog";
import { PauseCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassElevated,
  MorphTabs,
  ModuleFrame,
  StatusLegend,
  useIsPhone,
  useIsTablet,
} from "@hos-v2/ui";
import { verifyDeskManagerPin } from "../lib/desk-pin";
import {
  CATEGORIES,
  formatNu,
  getCartTotals,
  useFnbStore,
  type DietaryFlag,
  type PosTender,
} from "../lib/fnb-store";
import { useFrontOfficeStore } from "../lib/front-office-store";
import { EndOfShiftBriefing } from "../components/EndOfShiftBriefing";
import { PosMobileView } from "./mobile/PosMobileView";
import { PosTabletView } from "./mobile/PosTabletView";

const DIET_LABEL: Record<DietaryFlag, string> = {
  veg: "Veg",
  non_veg: "Non-veg",
  vegan: "Vegan",
  jain: "Jain",
  gluten_free: "GF",
  alcohol: "Alc",
};

const QUICK_CASH = [500, 1000, 2000, 5000, 10000];

export function PosPage() {
  const isPhone = useIsPhone();
  const isTablet = useIsTablet();
  const reduce = useReducedMotion();
  const [, start] = useTransition();
  const [pin, setPin] = useState("");
  const [heldOpen, setHeldOpen] = useState(false);

  const menu = useFnbStore((s) => s.menu);
  const outlets = useFnbStore((s) => s.outlets);
  const outletId = useFnbStore((s) => s.outletId);
  const tables = useFnbStore((s) => s.tables);
  const shift = useFnbStore((s) => s.shift);
  const category = useFnbStore((s) => s.category);
  const search = useFnbStore((s) => s.search);
  const cart = useFnbStore((s) => s.cart);
  const tableLabel = useFnbStore((s) => s.tableLabel);
  const coverCount = useFnbStore((s) => s.coverCount);
  const selectedStayId = useFnbStore((s) => s.selectedStayId);
  const heldChecks = useFnbStore((s) => s.heldChecks);
  const settleOpen = useFnbStore((s) => s.settleOpen);
  const cashTendered = useFnbStore((s) => s.cashTendered);
  const splitBtn = useFnbStore((s) => s.splitBtn);
  const orders = useFnbStore((s) => s.orders);
  const hydrateCatalog = useFnbStore((s) => s.hydrateCatalog);
  const setOutletId = useFnbStore((s) => s.setOutletId);
  const selectTable = useFnbStore((s) => s.selectTable);
  const openShift = useFnbStore((s) => s.openShift);
  const closeShift = useFnbStore((s) => s.closeShift);
  const setCategory = useFnbStore((s) => s.setCategory);
  const setSearch = useFnbStore((s) => s.setSearch);
  const setCoverCount = useFnbStore((s) => s.setCoverCount);
  const setSelectedStayId = useFnbStore((s) => s.setSelectedStayId);
  const setSettleOpen = useFnbStore((s) => s.setSettleOpen);
  const setCashTendered = useFnbStore((s) => s.setCashTendered);
  const setSplitBtn = useFnbStore((s) => s.setSplitBtn);
  const addToCart = useFnbStore((s) => s.addToCart);
  const bumpQty = useFnbStore((s) => s.bumpQty);
  const voidCartLine = useFnbStore((s) => s.voidCartLine);
  const clearCart = useFnbStore((s) => s.clearCart);
  const parkCheck = useFnbStore((s) => s.parkCheck);
  const resumeCheck = useFnbStore((s) => s.resumeCheck);
  const discardHeldCheck = useFnbStore((s) => s.discardHeldCheck);
  const fireKot = useFnbStore((s) => s.fireKot);
  const settle = useFnbStore((s) => s.settle);

  useEffect(() => {
    void hydrateCatalog();
  }, [hydrateCatalog]);

  const stays = useFrontOfficeStore((s) => s.stays);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const inHouse = stays.filter((s) => s.status === "checked_in" && s.roomNumber);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.filter((m) => {
      if (m.category !== category) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.dietary.some((d) => DIET_LABEL[d].toLowerCase().includes(q)) ||
        (m.portion ?? "").toLowerCase().includes(q)
      );
    });
  }, [menu, category, search]);

  const totals = getCartTotals(cart);
  const selectedStay = inHouse.find((s) => s.id === selectedStayId) ?? null;
  const changeDue = Math.max(0, cashTendered - totals.total);
  const shiftOpen = shift?.status === "open";
  const lineCount = cart.reduce((s, l) => s + l.qty, 0);

  const shiftBlock = !shiftOpen ? "Open shift first" : null;
  const emptyCartBlock = cart.length === 0 ? "Add menu items" : null;
  const fireBlock = shiftBlock ?? emptyCartBlock;
  const settleBlock = shiftBlock ?? emptyCartBlock;

  const onFire = () => {
    if (fireBlock) {
      toast.error(fireBlock);
      return;
    }
    start(() => {
      void fireKot().then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`KOT fired · ${res.kotIds.length} station(s)`, {
          description: "Visible on Kitchen Pass",
        });
      });
    });
  };

  const onHold = () => {
    if (emptyCartBlock) {
      toast.error(emptyCartBlock);
      return;
    }
    start(() => {
      const res = parkCheck();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Check held", {
        description: "Resume from Held when ready",
      });
    });
  };

  const onSettle = (tender: PosTender) => {
    if (settleBlock) {
      toast.error(settleBlock);
      return;
    }
    if (tender === "room_charge" && !selectedStayId) {
      toast.error("Select an in-house room", {
        description: "Room charge needs a guest folio",
      });
      return;
    }
    start(() => {
      void settle(tender, {
        cashGiven: cashTendered,
        pinConfirmed:
          tender === "city_ledger" || tender === "agent"
            ? verifyDeskManagerPin(pin).ok
            : true,
      }).then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`${res.billNo} settled`, {
          description:
            tender === "room_charge"
              ? `Folio · Rm ${selectedStay?.roomNumber}`
              : res.issueInv
                ? `INV · ${tender === "cash" ? `change ${formatNu(changeDue)}` : tender}`
                : `${tender} · AR`,
        });
        setPin("");
        setSettleOpen(false);
        if (tender === "room_charge" && selectedStayId) {
          openStay(selectedStayId);
        }
      });
    });
  };

  if (isPhone) return <PosMobileView />;
  if (isTablet) return <PosTabletView />;

  return (
    <ModuleFrame
      fill
      title="Touch POS"
      description={`${tableLabel} · ${lineCount} pcs · ${formatNu(totals.total)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "open", label: "Open check", swatch: "var(--hos-primary)" },
              { id: "fire", label: "Fired", swatch: "var(--hos-brass)" },
              { id: "paid", label: "Settled", swatch: "var(--hos-emerald)" },
            ]}
          />
          <Badge tone={shiftOpen ? "success" : "muted"}>
            {shiftOpen ? "Shift open" : "Shift closed"}
          </Badge>
          <Link
            to="/kds"
            className="text-xs font-semibold text-[var(--hos-primary)] underline-offset-2 hover:underline"
          >
            Kitchen Pass →
          </Link>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
        {/* 3-zone till */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
          {/* Left rail */}
          <aside className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
              Outlet
              <select
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-canvas)] px-2 py-2 text-xs font-semibold text-[var(--hos-ink)]"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>

            {shiftOpen ? (
              <Button
                size="sm"
                variant="secondary"
                className="!min-h-10 w-full"
                onClick={() => {
                  void closeShift(0).then((res) => {
                    if (!res.ok) toast.error(res.error);
                    else
                      toast.success(
                        res.offline ? "Shift closed (offline)" : "Shift closed",
                      );
                  });
                }}
              >
                Close shift
              </Button>
            ) : (
              <Button
                size="sm"
                className="hos-btn-ink !min-h-10 w-full"
                onClick={() => {
                  void openShift(5000).then((res) => {
                    if (!res.ok) {
                      toast.error("Could not open shift", {
                        description: res.error,
                      });
                      return;
                    }
                    toast.success(
                      res.offline
                        ? "Shift open offline"
                        : "Shift open",
                      {
                        description: `Opening float ${formatNu(5000)}`,
                      },
                    );
                  });
                }}
              >
                Open shift
              </Button>
            )}

            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
              Covers
              <input
                type="number"
                min={1}
                value={coverCount}
                onChange={(e) => setCoverCount(Number(e.target.value) || 1)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-canvas)] px-2 py-2 text-sm font-bold tabular-nums"
              />
            </label>

            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
              Tables
            </div>
            <div className="hos-scrollbar-slim min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTable(t.label)}
                  className={`hos-btn-tactile flex w-full items-center justify-between rounded-lg border px-2.5 py-2.5 text-left text-xs font-bold ${
                    tableLabel === t.label
                      ? "border-[#111] bg-[#111] text-white"
                      : t.status === "seated"
                        ? "border-amber-500/45 bg-amber-500/10 text-[var(--hos-ink)]"
                        : "border-[var(--hos-line)] bg-[var(--hos-canvas)] text-[var(--hos-ink-2)]"
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="font-medium opacity-70">{t.seats}p</span>
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant={heldChecks.length ? "secondary" : "ghost"}
              className="!min-h-10 w-full"
              onClick={() => setHeldOpen(true)}
            >
              <PauseCircle className="mr-1 size-3.5" aria-hidden />
              Held ({heldChecks.length})
            </Button>
          </aside>

          {/* Center menu — opaque tiles */}
          <section className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
            <MorphTabs
              glowId="posCatGlow"
              value={category}
              onChange={setCategory}
              items={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu…"
              className="shrink-0 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-canvas)] px-3 py-2.5 text-sm font-medium outline-none focus:border-[var(--hos-primary)]"
            />
            {!shiftOpen ? (
              <EmptyState
                title="Shift closed"
                description="Open a shift before ringing items."
                action={
                  <Button
                    size="sm"
                    className="hos-btn-ink"
                    onClick={() => {
                      void openShift(5000).then((res) => {
                        if (!res.ok) {
                          toast.error("Could not open shift", {
                            description: res.error,
                          });
                          return;
                        }
                        toast.success(
                          res.offline ? "Shift open offline" : "Shift open",
                          { description: `Opening float ${formatNu(5000)}` },
                        );
                      });
                    }}
                  >
                    Open shift
                  </Button>
                }
              />
            ) : items.length === 0 ? (
              <EmptyState
                title="No items"
                description="Try another category or clear search."
                action={
                  <Button size="sm" variant="secondary" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <div className="hos-scrollbar-slim grid min-h-0 flex-1 auto-rows-max grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {items.map((item) => (
                  <motion.button
                    key={item.id}
                    type="button"
                    disabled={!shiftOpen}
                    whileTap={reduce ? undefined : { scale: 0.97 }}
                    onClick={() => addToCart(item.id)}
                    className="flex min-h-[108px] flex-col items-stretch justify-between rounded-xl border border-[var(--hos-line)] bg-[var(--hos-canvas)] p-2.5 text-left shadow-none transition hover:border-[#111] disabled:opacity-40"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-2xl leading-none">{item.emoji}</span>
                      {item.popular ? (
                        <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-800">
                          TOP
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <div className="line-clamp-2 text-[12px] font-extrabold leading-snug text-[var(--hos-ink)]">
                        {item.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {item.dietary.slice(0, 2).map((d) => (
                          <span
                            key={d}
                            className="rounded bg-[rgba(17,17,17,0.06)] px-1 text-[8px] font-bold text-[var(--hos-ink-2)]"
                          >
                            {DIET_LABEL[d]}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 text-sm font-extrabold tabular-nums text-[var(--hos-ink)]">
                        {formatNu(item.netPrice)}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </section>

          {/* Right check */}
          <aside className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
            <div className="flex items-center justify-between">
              <strong className="text-sm text-[var(--hos-ink)]">Check · {tableLabel}</strong>
              <Badge tone="muted">{lineCount} pcs</Badge>
            </div>

            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
              Room charge guest
              <select
                value={selectedStayId ?? ""}
                onChange={(e) => setSelectedStayId(e.target.value || null)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-canvas)] px-2 py-2 text-xs font-semibold"
              >
                <option value="">Walk-in / table</option>
                {inHouse.map((s) => (
                  <option key={s.id} value={s.id}>
                    Rm {s.roomNumber} · {s.guestName}
                  </option>
                ))}
              </select>
            </label>

            {cart.length === 0 ? (
              <EmptyState
                title="Empty check"
                description="Tap menu tiles to build the order."
              />
            ) : (
              <div className="hos-scrollbar-slim min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                {cart.map((line) => (
                  <div
                    key={line.key}
                    className="flex items-center gap-2 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-canvas)] px-2 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-[var(--hos-ink)]">
                        {line.name}
                      </div>
                      <div className="text-[10px] tabular-nums text-[var(--hos-ink-3)]">
                        {formatNu(line.netUnit)} · {line.station}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-lg border border-[var(--hos-line)] text-sm font-bold"
                        onClick={() => bumpQty(line.key, -1)}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-xs font-extrabold tabular-nums">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-lg border border-[var(--hos-line)] text-sm font-bold"
                        onClick={() => bumpQty(line.key, 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-0.5 text-[10px] font-bold uppercase text-[var(--hos-ruby)]"
                        onClick={() => {
                          const gate = verifyDeskManagerPin(pin);
                          if (!gate.ok) {
                            toast.error("Manager PIN required to void", {
                              description: gate.error,
                            });
                            return;
                          }
                          const res = voidCartLine(line.key, pin);
                          if (!res.ok) toast.error(res.error);
                          else {
                            toast.message("Line voided");
                            setPin("");
                          }
                        }}
                      >
                        Void
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="shrink-0 space-y-1 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-canvas)] p-2.5 text-xs">
              <div className="flex justify-between text-[var(--hos-ink-3)]">
                <span>Net</span>
                <span className="font-semibold tabular-nums text-[var(--hos-ink)]">
                  {formatNu(totals.net)}
                </span>
              </div>
              <div className="flex justify-between text-[var(--hos-ink-3)]">
                <span>SC + BST</span>
                <span className="font-semibold tabular-nums text-[var(--hos-ink)]">
                  {formatNu(totals.sc + totals.bst)}
                </span>
              </div>
              <div className="flex justify-between border-t border-[var(--hos-line)] pt-1.5 text-sm font-extrabold text-[var(--hos-ink)]">
                <span>Total</span>
                <span className="tabular-nums text-[var(--hos-primary)]">
                  {formatNu(totals.total)}
                </span>
              </div>
              <div className="pt-1 text-[10px] text-[var(--hos-ink-3)]">
                Today · {orders.length} bills
              </div>
            </div>

            <label className="shrink-0 grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
              Manager PIN
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-canvas)] px-2 py-2 tracking-[0.25em]"
                placeholder="····"
              />
            </label>

            <div className="grid shrink-0 grid-cols-3 gap-1.5">
              <Button
                className="hos-btn-ink !min-h-11"
                size="sm"
                disabled={Boolean(fireBlock)}
                title={fireBlock ?? undefined}
                onClick={onFire}
              >
                Fire
              </Button>
              <Button
                className="!min-h-11"
                variant="secondary"
                size="sm"
                disabled={Boolean(emptyCartBlock)}
                title={emptyCartBlock ?? undefined}
                onClick={onHold}
              >
                Hold
              </Button>
              <Button
                className="hos-btn-ink !min-h-11"
                size="sm"
                disabled={Boolean(settleBlock)}
                title={settleBlock ?? undefined}
                onClick={() => {
                  setCashTendered(totals.total);
                  setSettleOpen(true);
                }}
              >
                Settle
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              disabled={cart.length === 0}
              onClick={() => {
                clearCart();
                toast.message("Cart cleared");
              }}
            >
              Clear
            </Button>
          </aside>
        </div>
      </div>

      <Dialog.Root open={heldOpen} onOpenChange={setHeldOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-[rgba(15,23,42,0.55)]" />
          <Dialog.Content asChild>
            <motion.div
              className="fixed right-0 top-0 z-[90] flex h-full w-[min(400px,100vw)] flex-col outline-none"
              initial={reduce ? false : { x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <GlassElevated className="flex h-full flex-col overflow-hidden rounded-none border-y-0 border-r-0 bg-[var(--hos-cell)] p-4 shadow-none">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <Dialog.Title className="m-0 text-lg font-bold text-[var(--hos-ink)]">
                      Held checks
                    </Dialog.Title>
                    <Dialog.Description className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
                      One API order id per check · max {heldChecks.length}/5
                    </Dialog.Description>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setHeldOpen(false)}>
                    Close
                  </Button>
                </div>
                {heldChecks.length === 0 ? (
                  <EmptyState
                    title="No held checks"
                    description="Tap Hold on the check to park the current order."
                  />
                ) : (
                  <ul className="m-0 flex-1 list-none space-y-2 overflow-auto p-0">
                    {heldChecks.map((h) => {
                      const t = getCartTotals(h.cart);
                      const ageMin = Math.max(
                        1,
                        Math.round((Date.now() - new Date(h.heldAt).getTime()) / 60_000),
                      );
                      return (
                        <li
                          key={h.id}
                          className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-canvas)] p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <strong className="text-sm text-[var(--hos-ink)]">{h.label}</strong>
                              <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                                {h.tableLabel} · {h.coverCount} covers · {h.cart.length} lines ·{" "}
                                {ageMin}m ago
                                {h.apiOrderId ? " · synced" : ""}
                              </p>
                            </div>
                            <span className="font-mono text-sm font-bold tabular-nums text-[var(--hos-primary)]">
                              {formatNu(t.total)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                const res = resumeCheck(h.id);
                                if (!res.ok) toast.error(res.error);
                                else {
                                  toast.success("Check resumed", { description: h.label });
                                  setHeldOpen(false);
                                }
                              }}
                            >
                              Resume
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const res = discardHeldCheck(h.id);
                                if (!res.ok) toast.error(res.error);
                                else toast.message("Held check discarded");
                              }}
                            >
                              Discard
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </GlassElevated>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={settleOpen} onOpenChange={setSettleOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-[rgba(9,13,22,0.45)]" />
          <Dialog.Content asChild>
            <motion.div
              className="fixed left-1/2 top-1/2 z-[90] w-[min(440px,94vw)] -translate-x-1/2 -translate-y-1/2 outline-none"
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
            >
              <GlassElevated className="p-5">
                <Dialog.Title className="m-0 text-lg font-bold text-[var(--hos-ink)]">
                  Settle check
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-[var(--hos-ink-3)]">
                  {tableLabel} · {formatNu(totals.total)} all-in · confirms on tap
                </Dialog.Description>

                <label className="mt-3 grid gap-1 text-xs font-medium text-[var(--hos-ink-2)]">
                  Split amount (Nu, optional)
                  <input
                    type="number"
                    min={0}
                    value={splitBtn || ""}
                    onChange={(e) => setSplitBtn(Number(e.target.value) || 0)}
                    className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm tabular-nums"
                    placeholder="0 = full check"
                  />
                </label>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["room_charge", "Room charge · folio", !selectedStayId],
                      ["cash", "Cash · INV", false],
                      ["card", "Card · INV", false],
                      ["rma_qr", "RMA QR · INV", false],
                      ["city_ledger", "City ledger", false],
                      ["agent", "Agent AR", false],
                    ] as const
                  ).map(([id, label, disabled]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled || Boolean(settleBlock)}
                      onClick={() => {
                        if (id === "cash") return;
                        if (
                          (id === "city_ledger" || id === "agent") &&
                          !verifyDeskManagerPin(pin).ok
                        ) {
                          toast.error("Manager PIN required for AR tender");
                          return;
                        }
                        onSettle(id);
                      }}
                      className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-canvas)] px-3 py-3 text-left text-sm font-semibold text-[var(--hos-ink)] disabled:opacity-40"
                    >
                      {label}
                      {id === "room_charge" && selectedStay ? (
                        <div className="text-[10px] font-medium text-[var(--hos-teal)]">
                          Rm {selectedStay.roomNumber}
                        </div>
                      ) : null}
                      {disabled ? (
                        <div className="text-[10px] text-[var(--hos-ruby)]">Select room first</div>
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-canvas)] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                    Cash
                  </div>
                  <input
                    type="number"
                    value={cashTendered || ""}
                    onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm tabular-nums"
                    placeholder="Cash given"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_CASH.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCashTendered(n)}
                        className="rounded-lg border border-[var(--hos-line)] px-2 py-1 text-[11px] font-semibold"
                      >
                        {n.toLocaleString()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashTendered(totals.total)}
                      className="rounded-lg border border-[var(--hos-primary)]/40 bg-[rgba(37,99,235,0.08)] px-2 py-1 text-[11px] font-semibold text-[var(--hos-primary)]"
                    >
                      Exact
                    </button>
                  </div>
                  <div className="mt-2 flex justify-between text-sm font-bold">
                    <span className="text-[var(--hos-ink-3)]">Change</span>
                    <span className="tabular-nums text-[var(--hos-emerald)]">
                      {formatNu(changeDue)}
                    </span>
                  </div>
                  <Button className="mt-3 w-full" size="sm" onClick={() => onSettle("cash")}>
                    Take cash · {formatNu(totals.total)}
                  </Button>
                </div>

                <Dialog.Close asChild>
                  <Button className="mt-3" variant="ghost" size="sm">
                    Cancel
                  </Button>
                </Dialog.Close>
              </GlassElevated>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="mt-3 flex shrink-0 justify-end">
        <EndOfShiftBriefing triggerLabel="End of shift" />
      </div>
    </ModuleFrame>
  );
}
