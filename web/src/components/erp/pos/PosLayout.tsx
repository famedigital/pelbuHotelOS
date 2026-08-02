"use client";

import { createDeskOrder, type DeskPosState } from "@/app/actions/erp-pos";
import { DeskLiveRefresh } from "@/components/erp/DeskLiveRefresh";
import { CartPanel } from "@/components/erp/pos/CartPanel";
import {
  DiningTableForm,
  type TableFormTarget,
} from "@/components/erp/pos/DiningTableForm";
import { KitchenTicketStrip } from "@/components/erp/pos/KitchenTicketStrip";
import { MenuGrid } from "@/components/erp/pos/MenuGrid";
import { ModifierDialog } from "@/components/erp/pos/ModifierDialog";
import { OpenTicketsDrawer } from "@/components/erp/pos/OpenTicketsDrawer";
import { PosFloorPlan } from "@/components/erp/pos/PosFloorPlan";
import { PosFullscreenToggle } from "@/components/erp/pos/PosFullscreenToggle";
import { PosClosingPanel } from "@/components/erp/pos/PosClosingPanel";
import { PosSearch } from "@/components/erp/pos/PosSearch";
import { PosStockPanel } from "@/components/erp/pos/PosStockPanel";
import { SettlePanel } from "@/components/erp/pos/SettlePanel";
import { TicketHeader } from "@/components/erp/pos/TicketHeader";
import { VoidReasonDialog } from "@/components/erp/pos/VoidReasonDialog";
import { KeyboardShortcutsOverlay } from "@/components/erp/pos/KeyboardShortcutsOverlay";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  useKeyboardShortcuts,
  type ShortcutBinding,
} from "@/hooks/use-keyboard-shortcuts";
import { calculateOrderTotals, formatBtn } from "@/lib/pricing";
import {
  ConciergeBellIcon,
  BoxesIcon,
  KeyboardIcon,
  ListOrderedIcon,
  LockKeyholeIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useActionState, useCallback, useMemo, useState } from "react";
import {
  type CartLine,
  type PosLayoutProps,
  type PosSection,
} from "./types";

const initial: DeskPosState = { ok: false };

function modifierKey(mods: { groupId: string; optionId: string; qty: number }[]): string {
  if (!mods.length) return "";
  return [...mods]
    .map((m) => `${m.groupId}:${m.optionId}:${Math.max(1, m.qty)}`)
    .sort()
    .join("|");
}

function lineKey(args: {
  menuItemId: string;
  mods: { groupId: string; optionId: string; qty: number }[];
  courseNo: number;
  seatNo?: number;
  lineNotes?: string;
}): string {
  return [
    args.menuItemId,
    modifierKey(args.mods),
    `c${args.courseNo ?? 1}`,
    args.seatNo ? `s${args.seatNo}` : "s0",
    `n:${(args.lineNotes ?? "").trim().toLowerCase().slice(0, 60)}`,
  ].join("::");
}

export function PosLayout({
  items,
  outlets,
  modifierGroups,
  tables,
  staff,
  openTickets,
  settledTickets = [],
  bookings,
  shift,
  gstRate,
  serviceChargeRate,
  serviceChargeDefaultOn,
  runtimeConfig,
  guestServiceSlot,
}: PosLayoutProps) {
  const [menuOutlet, setMenuOutlet] = useState<string>("all");
  const posOutlets = useMemo(
    () => outlets.map((o) => ({ value: o.code, label: o.name })),
    [outlets],
  );
  const defaultOutletCode = posOutlets[0]?.value ?? "cafe";
  const [section, setSection] = useState<PosSection>("menu");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [settleMode, setSettleMode] = useState<"cash" | "room_charge">("cash");
  const [tableId, setTableId] = useState<string>("");
  const [covers, setCovers] = useState<string>("");
  const [courseCount, setCourseCount] = useState<string>("1");
  const [serverStaffId, setServerStaffId] = useState<string>("");
  const [applyServiceCharge, setApplyServiceCharge] = useState(
    serviceChargeDefaultOn,
  );
  const [servicePercent, setServicePercent] = useState(
    String(Math.round(serviceChargeRate * 10000) / 100),
  );
  const [serviceReason, setServiceReason] = useState<string>("");

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [roomUnitId, setRoomUnitId] = useState("");
  const [bookingGuestId, setBookingGuestId] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [tableFormTarget, setTableFormTarget] = useState<TableFormTarget>(null);

  const [modifierTarget, setModifierTarget] = useState<
    | { mode: "add"; menuItemId: string }
    | { mode: "edit"; lineKey: string }
    | null
  >(null);

  const [cssFullscreen, setCssFullscreen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const openTicketsDrawer = useCallback(() => setTicketsOpen(true), []);
  const toggleFullscreen = useCallback(
    () => setCssFullscreen((v) => !v),
    [],
  );

  const shortcuts = useMemo<ShortcutBinding[]>(
    () => [
      {
        key: "1",
        label: "Go to Menu tab",
        display: "1",
        handler: () => setSection("menu"),
      },
      {
        key: "2",
        label: "Go to Floor plan tab",
        display: "2",
        handler: () => setSection("floor"),
      },
      {
        key: "3",
        label: "Go to Stock tab",
        display: "3",
        handler: () => setSection("stock"),
      },
      {
        key: "4",
        label: "Go to Closing tab",
        display: "4",
        handler: () => setSection("closing"),
      },
      {
        key: "5",
        label: "Go to Guest service tab",
        display: "5",
        handler: () => setSection("service"),
      },
      {
        key: "/",
        label: "Focus menu search",
        display: "/",
        handler: () => {
          const el = document.querySelector<HTMLInputElement>(
            'input[type="search"][placeholder*="earch"]',
          );
          el?.focus();
        },
      },
      {
        key: "t",
        label: "Open tickets drawer",
        display: "T",
        handler: openTicketsDrawer,
      },
      {
        key: "f",
        shift: true,
        label: "Toggle fullscreen",
        display: "Shift+F",
        handler: toggleFullscreen,
      },
      {
        key: "?",
        label: "Show keyboard shortcuts",
        display: "?",
        handler: () => setShortcutsOpen((v) => !v),
      },
      {
        key: "Escape",
        label: "Close dialog / overlay",
        display: "Esc",
        handler: () => {
          setShortcutsOpen(false);
        },
      },
    ],
    [openTicketsDrawer, toggleFullscreen],
  );
  useKeyboardShortcuts(shortcuts);

  const [state, action, pending] = useActionState(createDeskOrder, initial);
  useActionToast(state);

  const menuItems = useMemo(
    () =>
      menuOutlet === "all"
        ? items
        : items.filter((item) => item.outlet === menuOutlet),
    [items, menuOutlet],
  );

  const groupsByItem = useMemo(() => {
    const map = new Map<string, typeof modifierGroups>();
    for (const g of modifierGroups) {
      const list = map.get(g.menu_item_id) ?? [];
      list.push(g);
      map.set(g.menu_item_id, list);
    }
    return map;
  }, [modifierGroups]);

  const categories = useMemo(() => {
    const set: string[] = [];
    for (const item of menuItems) {
      if (!set.includes(item.category)) set.push(item.category);
    }
    return set;
  }, [menuItems]);

  const allTables = tables;

  function setMenuOutletFilter(next: string) {
    setMenuOutlet(next);
    setCategory("all");
  }

  function addItemQuick(menuItemId: string) {
    const item = items.find((m) => m.id === menuItemId);
    if (!item) return;
    const hasGroups = (groupsByItem.get(item.id) ?? []).length > 0;
    if (hasGroups) {
      setModifierTarget({ mode: "add", menuItemId });
      return;
    }
    const key = lineKey({
      menuItemId,
      mods: [],
      courseNo: 1,
      seatNo: undefined,
      lineNotes: undefined,
    });
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: Math.min(40, copy[idx].qty + 1) };
        return copy;
      }
      return [
        ...prev,
        {
          key,
          menuItemId,
          name: item.name,
          unitPriceBtn: item.price_btn,
          gstApplicable: item.gst_applicable,
          qty: 1,
          modifiers: [],
          modifierSnapshots: [],
          courseNo: 1,
          seatNo: undefined,
          lineNotes: undefined,
        },
      ];
    });
  }

  function upsertLine(line: CartLine) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.key === line.key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = line;
        return copy;
      }
      return [...prev, line];
    });
  }

  function setLineQty(key: string, qty: number) {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((l) => l.key !== key);
      return prev.map((l) =>
        l.key === key ? { ...l, qty: Math.min(40, qty) } : l,
      );
    });
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function editLine(key: string) {
    if (!cart.some((l) => l.key === key)) return;
    setModifierTarget({ mode: "edit", lineKey: key });
  }

  function stepLine(key: string, delta: number) {
    const line = cart.find((l) => l.key === key);
    if (!line) return;
    setLineQty(key, line.qty + delta);
  }

  function clearCart() {
    setCart([]);
  }

  /** Selecting a table on the floor plan seats the ticket and jumps to the menu. */
  function selectTable(nextTableId: string, seats: number) {
    if (tableId === nextTableId) {
      setTableId("");
      return;
    }
    setTableId(nextTableId);
    if (!covers) setCovers(String(seats));
    setSection("menu");
  }

  function selectRoom(nextRoomUnitId: string) {
    setRoomUnitId(nextRoomUnitId);
    if (!nextRoomUnitId) {
      setBookingId("");
      setBookingGuestId("");
      return;
    }
    const booking = bookings.find((candidate) =>
      candidate.rooms.some((room) => room.id === nextRoomUnitId),
    );
    if (!booking) return;
    setBookingId(booking.id);
    setBookingGuestId("");
    setCustomerName(booking.contact_name ?? "In-house guest");
    setPhone(booking.contact_phone ?? "");
    // Room selection identifies the guest but never changes who pays.
    // Cash/guest payment remains selected until the cashier explicitly taps Room.
  }

  function selectBookingGuest(nextGuestId: string) {
    setBookingGuestId(nextGuestId);
    const booking = bookings.find((candidate) => candidate.id === bookingId);
    if (!booking) return;
    const guest = nextGuestId
      ? booking.guests.find((candidate) => candidate.id === nextGuestId)
      : booking.guests[0];
    if (!guest) return;
    setCustomerName(guest.full_name);
    setPhone(guest.phone ?? booking.contact_phone ?? "");
  }

  const cartPayload = useMemo(
    () =>
      cart.map((l) => ({
        menuItemId: l.menuItemId,
        qty: l.qty,
        modifiers:
          l.modifiers.length > 0
            ? l.modifiers.map((m) => ({
                groupId: m.groupId,
                optionId: m.optionId,
                qty: m.qty,
              }))
            : undefined,
        courseNo: l.courseNo,
        seatNo: l.seatNo,
        lineNotes: l.lineNotes,
      })),
    [cart],
  );

  const totals = useMemo(() => {
    const lines = cart.map((line) => ({
      qty: line.qty,
      unitPriceBtn: line.unitPriceBtn,
      gstApplicable: line.gstApplicable,
      modifiers: line.modifierSnapshots.map((m) => ({
        priceBtn: m.priceBtn,
        qty: m.qty,
        gstApplicable: m.gstApplicable,
      })),
    }));
    return calculateOrderTotals(lines, {
      gstRate,
      serviceChargeRate: Number(servicePercent || 0) / 100,
      applyServiceCharge,
    });
  }, [cart, applyServiceCharge, gstRate, servicePercent]);

  const lineCount = cart.reduce((sum, l) => sum + l.qty, 0);

  const shellClass = cssFullscreen
    ? "erp pos-fs-shell space-y-4"
    : "erp space-y-4";

  const sharedDialogs = (
    <>
      <OpenTicketsDrawer
        open={ticketsOpen}
        onOpenChange={setTicketsOpen}
        tickets={openTickets}
        settledTickets={settledTickets}
        bookings={bookings}
        tables={tables}
        onSettle={(id) => {
          setTicketsOpen(false);
          setSettleTarget(id);
        }}
        onVoid={(id) => {
          setTicketsOpen(false);
          setVoidTarget(id);
        }}
      />
      <SettlePanel
        orderId={settleTarget}
        onOpenChange={(open) => !open && setSettleTarget(null)}
        bookings={bookings}
        liveTickets={openTickets}
        tenderMethods={runtimeConfig.tenderMethods}
      />
      <VoidReasonDialog
        orderId={voidTarget}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        ticket={openTickets.find((t) => t.id === voidTarget) ?? null}
        voidReasonCodes={runtimeConfig.voidReasonCodes}
        voidManagerThresholdBtn={runtimeConfig.voidManagerThresholdBtn}
      />
      <DiningTableForm
        target={tableFormTarget}
        onOpenChange={(open) => !open && setTableFormTarget(null)}
        defaultOutlet={
          posOutlets.find((o) => o.value === menuOutlet)?.value ??
          defaultOutletCode
        }
        outlets={posOutlets}
        existingNames={tables.map((t) => t.name)}
      />
    </>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Point of sale
        </p>
        <DeskLiveRefresh />
      </div>

      <div className="flex items-center gap-2">
        {openTickets.length > 0 ? (
          <Badge variant="secondary">{openTickets.length} open</Badge>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => setTicketsOpen(true)}
        >
          <ListOrderedIcon className="size-4" />
          <span className="hidden sm:inline">Open tickets</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-9 px-2 sm:inline-flex"
          onClick={() => setShortcutsOpen(true)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <KeyboardIcon className="size-4" />
        </Button>
        <PosFullscreenToggle
          active={cssFullscreen}
          onChange={setCssFullscreen}
        />
      </div>
    </div>
  );

  // Success strip — mirrors the legacy "order on the KOT board" state.
  if (state.ok && state.orderId) {
    return (
      <div className={shellClass}>
        {toolbar}
        <KitchenTicketStrip
          openTickets={openTickets}
          onOpenTickets={() => setTicketsOpen(true)}
        />
        <div
          className="erp rounded-xl border bg-card p-6"
          role="status"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {state.settleMode === "room_charge" && state.folioId
              ? "Charged to room"
              : "Ticket saved"}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {state.settleMode === "room_charge" && state.folioId
              ? "On the guest folio"
              : "Order is on the KOT board"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ref{" "}
            <span className="font-mono text-foreground">{state.orderId}</span>
            {state.totalBtn != null ? ` · ${formatBtn(state.totalBtn)}` : ""}
            {state.message ? ` · ${state.message}` : null}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild variant="citrus" className="h-11">
              <a href="/erp/pos">New ticket</a>
            </Button>
            {state.folioId ? (
              <Button asChild variant="outline" className="h-11">
                <a href={`/erp/folios/${state.folioId}`}>Open folio</a>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="h-11">
              <a href="/erp">Order board</a>
            </Button>
          </div>
        </div>
        {sharedDialogs}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {toolbar}

      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as PosSection)}
        className="gap-4"
      >
        <TabsList className="h-auto min-h-10 w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="menu" className="px-4">
            Menu
          </TabsTrigger>
          <TabsTrigger value="floor" className="px-4">
            Floor plan
            {allTables.length > 0 ? (
              <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
                {allTables.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="stock" className="px-4">
            <BoxesIcon className="size-4" />
            Stock
          </TabsTrigger>
          <TabsTrigger value="closing" className="px-4">
            <LockKeyholeIcon className="size-4" />
            Closing
            {shift ? (
              <span className="ml-1 size-2 rounded-full bg-emerald-500" />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="service" className="px-4">
            <ConciergeBellIcon className="size-4" />
            Guest service
          </TabsTrigger>
        </TabsList>

        {/* Menu + floor plan share the ticket form, so both panels stay mounted
            (forceMount + CSS hide) to preserve cart and field state on switch. */}
        <div
          className={
            section === "menu" || section === "floor"
              ? "space-y-4"
              : "hidden"
          }
        >
          <TicketHeader
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            phone={phone}
            onPhoneChange={setPhone}
            settleMode={settleMode}
            onSettleModeChange={setSettleMode}
            bookingId={bookingId}
            roomUnitId={roomUnitId}
            onRoomUnitIdChange={selectRoom}
            bookingGuestId={bookingGuestId}
            onBookingGuestIdChange={selectBookingGuest}
            bookings={bookings}
            notes={notes}
            onNotesChange={setNotes}
            tables={tables}
            tableId={tableId}
            onTableIdChange={setTableId}
            covers={covers}
            onCoversChange={setCovers}
            courseCount={courseCount}
            onCourseCountChange={setCourseCount}
            staff={staff}
            serverStaffId={serverStaffId}
            onServerStaffIdChange={setServerStaffId}
          />

          <KitchenTicketStrip
            openTickets={openTickets}
            onOpenTickets={() => setTicketsOpen(true)}
          />

          <form action={action} className="block">
            {/* Hidden inputs — contract must match createDeskOrder */}
            <input type="hidden" name="cart" value={JSON.stringify(cartPayload)} />
            <input type="hidden" name="settle_mode" value={settleMode} />
            <input
              type="hidden"
              name="booking_id"
              value={bookingId}
            />
            <input type="hidden" name="room_unit_id" value={roomUnitId} />
            <input
              type="hidden"
              name="booking_guest_id"
              value={bookingGuestId}
            />
            <input type="hidden" name="table_id" value={tableId} />
            <input type="hidden" name="covers" value={covers} />
            <input type="hidden" name="course_count" value={courseCount} />
            <input type="hidden" name="server_staff_id" value={serverStaffId} />
            <input type="hidden" name="customer_name" value={customerName} />
            <input type="hidden" name="phone" value={phone} />
            <input type="hidden" name="notes" value={notes} />
            <input
              type="hidden"
              name="service_charge_applied"
              value={applyServiceCharge ? "1" : "0"}
            />
            <input type="hidden" name="service_charge_rate" value={servicePercent} />
            <input
              type="hidden"
              name="service_charge_reason"
              value={serviceReason}
            />

            {state.error ? (
              <Alert variant="destructive" className="mb-4">
                <TriangleAlertIcon />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_clamp(320px,30vw,440px)]">
              <div className="min-w-0">
                <TabsContent
                  value="menu"
                  forceMount
                  className="data-[state=inactive]:hidden"
                >
                  <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                    <aside className="hidden lg:flex lg:flex-col lg:gap-3">
                      <PosSearch value={search} onChange={setSearch} />
                      <nav
                        className="flex flex-col gap-1"
                        aria-label="Menu categories"
                      >
                        <CategoryButton
                          active={category === "all"}
                          onClick={() => setCategory("all")}
                          label="All"
                          count={menuItems.length}
                        />
                        {categories.map((cat) => (
                          <CategoryButton
                            key={cat}
                            active={category === cat}
                            onClick={() => setCategory(cat)}
                            label={cat}
                            count={
                              menuItems.filter((i) => i.category === cat).length
                            }
                          />
                        ))}
                      </nav>
                    </aside>

                    <div className="min-w-0">
                      <div className="mb-3 flex flex-col gap-2 lg:hidden">
                        <PosSearch value={search} onChange={setSearch} />
                        <div className="flex flex-wrap gap-1.5">
                          <OutletChip
                            active={menuOutlet === "all"}
                            onClick={() => setMenuOutletFilter("all")}
                            label="All"
                          />
                          {posOutlets.map((o) => (
                            <OutletChip
                              key={o.value}
                              active={menuOutlet === o.value}
                              onClick={() => setMenuOutletFilter(o.value)}
                              label={o.label}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <CategoryChip
                            active={category === "all"}
                            onClick={() => setCategory("all")}
                            label="All"
                          />
                          {categories.map((cat) => (
                            <CategoryChip
                              key={cat}
                              active={category === cat}
                              onClick={() => setCategory(cat)}
                              label={cat}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="mb-3 hidden flex-wrap gap-1.5 lg:flex">
                        <OutletChip
                          active={menuOutlet === "all"}
                          onClick={() => setMenuOutletFilter("all")}
                          label="All outlets"
                        />
                        {posOutlets.map((o) => (
                          <OutletChip
                            key={o.value}
                            active={menuOutlet === o.value}
                            onClick={() => setMenuOutletFilter(o.value)}
                            label={o.label}
                          />
                        ))}
                      </div>

                      <MenuGrid
                        items={menuItems}
                        category={category}
                        search={search}
                        onAdd={addItemQuick}
                        onEditLine={editLine}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent
                  value="floor"
                  forceMount
                  className="data-[state=inactive]:hidden"
                >
                  <PosFloorPlan
                    outlet={null}
                    tables={tables}
                    openTickets={openTickets}
                    selectedTableId={tableId}
                    onSelectTable={selectTable}
                    onAddTable={() => setTableFormTarget({ mode: "create" })}
                    onEditTable={(table) =>
                      setTableFormTarget({ mode: "edit", table })
                    }
                    onOpenTicket={(orderId) => setSettleTarget(orderId)}
                  />
                </TabsContent>
              </div>

              <aside className="hidden lg:sticky lg:top-3 lg:block lg:self-start">
                <CartPanel
                  cart={cart}
                  totals={totals}
                  lineCount={lineCount}
                  pending={pending}
                  gstRate={gstRate}
                  servicePercent={servicePercent}
                  serviceReason={serviceReason}
                  applyServiceCharge={applyServiceCharge}
                  serviceChargeDefaultOn={serviceChargeDefaultOn}
                  onApplyServiceChargeChange={setApplyServiceCharge}
                  onServicePercentChange={setServicePercent}
                  onServiceReasonChange={setServiceReason}
                  onInc={(key) => stepLine(key, 1)}
                  onDec={(key) => stepLine(key, -1)}
                  onRemove={removeLine}
                  onClear={clearCart}
                  onEditLine={editLine}
                  idPrefix="cart_desktop"
                />
              </aside>
            </div>

            {/* Mobile — cart trigger bar + bottom sheet */}
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setCartSheetOpen(true)}
                className="fixed inset-x-3 bottom-3 z-30 flex h-14 items-center justify-between rounded-xl bg-primary px-4 text-primary-foreground shadow-lg"
                aria-label="Open cart"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-foreground/20 text-xs tabular-nums">
                    {lineCount}
                  </span>
                  View ticket
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatBtn(totals.totalBtn)}
                </span>
              </button>

              <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
                <SheetContent
                  side="bottom"
                  portal={false}
                  className="erp p-0 sm:max-w-full"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Ticket</SheetTitle>
                  </SheetHeader>
                  <div className="max-h-[85dvh] overflow-hidden p-4">
                    <CartPanel
                      cart={cart}
                      totals={totals}
                      lineCount={lineCount}
                      pending={pending}
                      gstRate={gstRate}
                      servicePercent={servicePercent}
                      serviceReason={serviceReason}
                      applyServiceCharge={applyServiceCharge}
                      serviceChargeDefaultOn={serviceChargeDefaultOn}
                      onApplyServiceChargeChange={setApplyServiceCharge}
                      onServicePercentChange={setServicePercent}
                      onServiceReasonChange={setServiceReason}
                      onInc={(key) => stepLine(key, 1)}
                      onDec={(key) => stepLine(key, -1)}
                      onRemove={removeLine}
                      onClear={clearCart}
                      onEditLine={editLine}
                      idPrefix="cart_mobile"
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </form>
        </div>

        <TabsContent value="stock">
          <PosStockPanel items={items} />
        </TabsContent>
        <TabsContent value="closing">
          <PosClosingPanel shift={shift} />
        </TabsContent>
        <TabsContent value="service">{guestServiceSlot}</TabsContent>
      </Tabs>

      <ModifierDialog
        target={modifierTarget}
        onOpenChange={(open) => !open && setModifierTarget(null)}
        items={items}
        groupsByItem={groupsByItem}
        cart={cart}
        onUpsert={(line) => {
          upsertLine(line);
          setModifierTarget(null);
        }}
        onRemove={(key) => {
          removeLine(key);
          setModifierTarget(null);
        }}
      />

      <KeyboardShortcutsOverlay
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        bindings={shortcuts}
      />

      {sharedDialogs}
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center justify-between gap-2 rounded-md border px-3 text-left text-sm transition-colors ${
        active
          ? "border-accent/40 bg-accent/10 text-foreground"
          : "border-transparent text-muted-foreground hover:bg-secondary"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
        active
          ? "border-accent/40 bg-accent/10 text-foreground"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function OutletChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-md border px-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active
          ? "border-foreground/30 bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
