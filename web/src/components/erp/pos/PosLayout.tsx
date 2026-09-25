"use client";

import { fetchPosTicketsSnapshot } from "@/app/actions/desk-read-loaders";
import {
  appendDeskOrderItems,
  createDeskOrder,
  updateTableStatus,
  type DeskPosState,
} from "@/app/actions/erp-pos";
import { DeskSyncChip } from "@/components/erp/DeskSyncChip";
import { CartPanel } from "@/components/erp/pos/CartPanel";
import {
  DiningTableForm,
  type TableFormTarget,
} from "@/components/erp/pos/DiningTableForm";
import { KitchenTicketStrip } from "@/components/erp/pos/KitchenTicketStrip";
import { MenuGrid } from "@/components/erp/pos/MenuGrid";
import { ModifierDialog } from "@/components/erp/pos/ModifierDialog";
import { OpenTicketsDrawer } from "@/components/erp/pos/OpenTicketsDrawer";
import { PosBootstrapCacheWriter } from "@/components/erp/pos/PosBootstrapCacheWriter";
import { PosFloorPlan, type FloorKey } from "@/components/erp/pos/PosFloorPlan";
import { PosHowToSheet } from "@/components/erp/pos/PosHowToSheet";
import { PosRegisterHeaderChrome } from "@/components/erp/pos/PosRegisterHeaderChrome";
import { PosClosingPanel } from "@/components/erp/pos/PosClosingPanel";
import {
  PosSaleStartGate,
  type PosSaleKind,
} from "@/components/erp/pos/PosSaleStartGate";
import { PosSearch } from "@/components/erp/pos/PosSearch";
import { PosStockPanel } from "@/components/erp/pos/PosStockPanel";
import { SettlePanel } from "@/components/erp/pos/SettlePanel";
import { TicketHeader } from "@/components/erp/pos/TicketHeader";
import { VoidReasonDialog } from "@/components/erp/pos/VoidReasonDialog";
import { resolvePosBarcode } from "@/app/actions/pos-barcode";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  useKeyboardShortcuts,
  type ShortcutBinding,
} from "@/hooks/use-keyboard-shortcuts";
import {
  DESK_CACHE_TTL,
  deskCacheKey,
  setDeskReadCache,
} from "@/lib/desk/desk-read-cache";
import { routeKotPrintOnSend } from "@/lib/pos-print-prefs";
import { cn } from "@/lib/utils";
import { calculateOrderTotals, formatBtn } from "@/lib/pricing";
import { toast } from "sonner";
import type { OpenPosTicket } from "@/lib/pos";
import {
  canAddItemsToOpenTicket,
  nextCourseNoForTicket,
} from "@/lib/pos-ticket";
import {
  readPosFloorPref,
  readPosLastKind,
  readPosMenuOutletPref,
  writePosFloorPref,
  writePosLastKind,
  writePosMenuOutletPref,
} from "@/lib/pos-prefs";
import { TriangleAlertIcon } from "lucide-react";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  propertyId,
  items,
  outlets,
  modifierGroups,
  tables,
  staff,
  openTickets: openTicketsProp,
  settledTickets: settledTicketsProp = [],
  bookings,
  creditAgents = [],
  shift,
  shiftCloseSummary = null,
  gstRate,
  serviceChargeRate,
  serviceChargeDefaultOn,
  runtimeConfig,
  guestServiceSlot,
  ncReasons = [],
  canFireKot = true,
  posTrainingMode = false,
}: PosLayoutProps) {
  const [openTickets, setOpenTickets] = useState(openTicketsProp);
  const [settledTickets, setSettledTickets] = useState(settledTicketsProp);
  const [ticketsSyncing, setTicketsSyncing] = useState(false);

  useEffect(() => {
    setOpenTickets(openTicketsProp);
  }, [openTicketsProp]);
  useEffect(() => {
    setSettledTickets(settledTicketsProp);
  }, [settledTicketsProp]);

  const patchTicketsFromNetwork = useCallback(async () => {
    setTicketsSyncing(true);
    try {
      const snap = await fetchPosTicketsSnapshot();
      if (!snap.ok) throw new Error(snap.error);
      setOpenTickets(snap.openTickets);
      setSettledTickets(snap.settledTickets);
      await setDeskReadCache({
        key: deskCacheKey("pos:tickets", propertyId),
        propertyId,
        payload: {
          openTickets: snap.openTickets,
          settledTickets: snap.settledTickets,
        },
        hardMs: DESK_CACHE_TTL.posTickets.hardMs,
      });
    } finally {
      setTicketsSyncing(false);
    }
  }, [propertyId]);

  const [menuOutlet, setMenuOutlet] = useState<string>("all");
  const posOutlets = useMemo(
    () => outlets.map((o) => ({ value: o.code, label: o.name })),
    [outlets],
  );
  const defaultOutletCode = posOutlets[0]?.value ?? "cafe";
  /** Which outlet floor the plan is showing (null = Shared tables). */
  const [floorOutlet, setFloorOutlet] = useState<FloorKey>(defaultOutletCode);
  /** null = Table / Room / Counter start gate (menu locked). */
  const [saleKind, setSaleKind] = useState<PosSaleKind | null>(null);
  /** Let staff mix floors on a table seat when needed. */
  const [menuUnlocked, setMenuUnlocked] = useState(false);
  const [lastKindPref, setLastKindPref] = useState<PosSaleKind | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);
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
  const [promoCode, setPromoCode] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  const [managerPin, setManagerPin] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [roomUnitId, setRoomUnitId] = useState("");
  const [bookingGuestId, setBookingGuestId] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  /** Bumps animation on each add so staff see the cart bar acknowledge the tap. */
  const [cartBump, setCartBump] = useState(0);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidItemId, setVoidItemId] = useState<string | null>(null);
  /** Remount VoidReasonDialog so useActionState does not keep ok=true after a void. */
  const [voidSession, setVoidSession] = useState(0);
  /** When set, Send appends to this unpaid ticket instead of creating another. */
  const [appendOrderId, setAppendOrderId] = useState<string | null>(null);
  const [appendCourseNo, setAppendCourseNo] = useState(1);
  const [tableFormTarget, setTableFormTarget] = useState<TableFormTarget>(null);

  const [modifierTarget, setModifierTarget] = useState<
    | { mode: "add"; menuItemId: string }
    | { mode: "edit"; lineKey: string }
    | null
  >(null);

  const [cssFullscreen, setCssFullscreen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const roomCount = useMemo(
    () => bookings.reduce((n, b) => n + b.rooms.length, 0),
    [bookings],
  );

  // Hydrate floor / last path prefs once on mount (client only).
  useEffect(() => {
    const floor = readPosFloorPref(defaultOutletCode);
    if (floor === null || posOutlets.some((o) => o.value === floor)) {
      setFloorOutlet(floor);
    }
    setLastKindPref(readPosLastKind());
    setMenuOutlet(readPosMenuOutletPref("all"));
    setPrefsReady(true);
  }, [defaultOutletCode, posOutlets]);

  useEffect(() => {
    if (!prefsReady) return;
    writePosFloorPref(floorOutlet);
  }, [floorOutlet, prefsReady]);

  useEffect(() => {
    if (!prefsReady) return;
    writePosMenuOutletPref(menuOutlet);
  }, [menuOutlet, prefsReady]);

  /** Menu / cart only after context is ready for this sale kind. */
  const saleReady =
    saleKind === "counter" ||
    (saleKind === "table" && Boolean(tableId)) ||
    (saleKind === "room" && Boolean(roomUnitId));

  const openTicketsDrawer = useCallback(() => setTicketsOpen(true), []);
  const toggleFullscreen = useCallback(
    () => setCssFullscreen((v) => !v),
    [],
  );

  function startSaleKind(kind: PosSaleKind) {
    setAppendOrderId(null);
    setAppendCourseNo(1);
    setSaleKind(kind);
    setMenuUnlocked(false);
    writePosLastKind(kind);
    setLastKindPref(kind);
    if (kind === "table") {
      setSettleMode("cash");
      setRoomUnitId("");
      setBookingId("");
      setBookingGuestId("");
      setSection("floor");
      return;
    }
    if (kind === "room") {
      setSettleMode("room_charge");
      setTableId("");
      setCovers("");
      if (!customerName.trim()) setCustomerName("In-house guest");
      setSection("menu");
      return;
    }
    // Counter
    setSettleMode("cash");
    setTableId("");
    setCovers("");
    setRoomUnitId("");
    setBookingId("");
    setBookingGuestId("");
    if (!customerName.trim()) setCustomerName("Walk-in");
    setMenuOutlet(readPosMenuOutletPref("all"));
    setCategory("all");
    setSection("menu");
  }

  /**
   * Soft switch between Table / Room / Counter — keeps cart when possible so
   * staff can re-tag a walking-party without re-tapping dishes.
   */
  function softSwitchSaleKind(kind: PosSaleKind) {
    if (kind === saleKind) return;
    setAppendOrderId(null);
    setAppendCourseNo(1);
    setSaleKind(kind);
    setMenuUnlocked(false);
    writePosLastKind(kind);
    setLastKindPref(kind);
    if (kind === "table") {
      setSettleMode("cash");
      setSection(tableId ? "menu" : "floor");
      return;
    }
    if (kind === "room") {
      setSettleMode("room_charge");
      if (!customerName.trim() || customerName.startsWith("Table ")) {
        setCustomerName("In-house guest");
      }
      setSection("menu");
      return;
    }
    setSettleMode("cash");
    if (!customerName.trim() || customerName.startsWith("Table ")) {
      setCustomerName("Walk-in");
    }
    setSection("menu");
  }

  function resetSaleContext() {
    setSaleKind(null);
    setMenuUnlocked(false);
    setTableId("");
    setCovers("");
    setRoomUnitId("");
    setBookingId("");
    setBookingGuestId("");
    setSettleMode("cash");
    setSection("menu");
    setCart([]);
    setSearch("");
    setCategory("all");
    setPromoCode("");
    setManagerPin("");
    setAppendOrderId(null);
    setAppendCourseNo(1);
    setCourseCount("1");
  }

  const shortcuts = useMemo<ShortcutBinding[]>(
    () => [
      {
        key: "t",
        label: saleKind ? "Open tickets drawer" : "Start Table sale",
        display: "T",
        handler: () => {
          if (!saleKind) startSaleKind("table");
          else openTicketsDrawer();
        },
      },
      {
        key: "r",
        label: saleKind ? "Switch to Room path" : "Start Room sale",
        display: "R",
        handler: () => {
          if (!saleKind) {
            if (roomCount > 0) startSaleKind("room");
            return;
          }
          softSwitchSaleKind("room");
        },
      },
      {
        key: "c",
        label: saleKind ? "Switch to Counter path" : "Start Counter sale",
        display: "C",
        handler: () => {
          if (!saleKind) startSaleKind("counter");
          else softSwitchSaleKind("counter");
        },
      },
      {
        key: "n",
        label: "New ticket (clear cart)",
        display: "N",
        handler: () => resetSaleContext(),
      },
      {
        key: "1",
        label: "Sell / menu",
        display: "1",
        handler: () => {
          if (!saleKind) return;
          setSection("menu");
        },
      },
      {
        key: "2",
        label: "Floor plan (table sale)",
        display: "2",
        handler: () => {
          if (saleKind !== "table") softSwitchSaleKind("table");
          else setSection("floor");
        },
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
          if (!saleReady) return;
          const el = document.querySelector<HTMLInputElement>(
            'input[type="search"][placeholder*="earch"]',
          );
          el?.focus();
        },
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
    // handlers close over latest state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openTicketsDrawer, toggleFullscreen, saleKind, saleReady, roomCount],
  );
  useKeyboardShortcuts(shortcuts);

  const [createState, createAction, createPending] = useActionState(
    createDeskOrder,
    initial,
  );
  const [appendState, appendAction, appendPending] = useActionState(
    appendDeskOrderItems,
    initial,
  );
  const pending = createPending || appendPending;
  useActionToast(createState);
  useActionToast(appendState);

  const lastHandledAppend = useRef<string | null>(null);
  useEffect(() => {
    if (!appendState.ok || !appendState.appended || !appendState.orderId) {
      return;
    }
    const token = `${appendState.orderId}:${appendState.courseNo}:${appendState.totalBtn}`;
    if (lastHandledAppend.current === token) return;
    lastHandledAppend.current = token;
    setCart([]);
    setManagerPin("");
    setCartSheetOpen(false);
    const next = Math.min(12, (appendState.courseNo ?? 1) + 1);
    setAppendCourseNo(next);
    setCourseCount(String(next));
  }, [appendState]);

  /**
   * Table sales lock the sell menu to that table's floor (cafe table → cafe
   * items only). Unlock lets staff pull any floor when the guest orders a mix.
   * Shared tables and Counter/Room keep the full chip filter.
   */
  const lockedMenuOutlet = useMemo(() => {
    if (menuUnlocked) return null;
    if (saleKind !== "table" || !tableId) return null;
    const table = tables.find((t) => t.id === tableId);
    return table?.outlet ?? null;
  }, [menuUnlocked, saleKind, tableId, tables]);

  const effectiveMenuOutlet = lockedMenuOutlet ?? menuOutlet;

  const menuItems = useMemo(() => {
    if (effectiveMenuOutlet === "all" || !effectiveMenuOutlet) {
      return items;
    }
    return items.filter((item) => item.outlet === effectiveMenuOutlet);
  }, [items, effectiveMenuOutlet]);

  // Cafe table + no cafe dishes → unlock so Sell isn't a blank page.
  useEffect(() => {
    if (!lockedMenuOutlet) return;
    if (items.length === 0) return;
    const lockedCount = items.filter(
      (item) => item.outlet === lockedMenuOutlet,
    ).length;
    if (lockedCount === 0) setMenuUnlocked(true);
  }, [lockedMenuOutlet, items]);

  const lockedMenuLabel =
    lockedMenuOutlet != null
      ? (posOutlets.find((o) => o.value === lockedMenuOutlet)?.label ??
        lockedMenuOutlet)
      : null;

  const naturalTableOutlet =
    saleKind === "table" && tableId
      ? (tables.find((t) => t.id === tableId)?.outlet ?? null)
      : null;

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
    if (lockedMenuOutlet) return;
    setMenuOutlet(next);
    setCategory("all");
  }

  /** Drop cart lines that don't belong on the active menu floor. */
  function pruneCartToOutlet(outlet: string | null) {
    if (!outlet || outlet === "all") return;
    setCart((prev) =>
      prev.filter((line) => {
        const item = items.find((m) => m.id === line.menuItemId);
        return !item || item.outlet === outlet;
      }),
    );
  }

  const activeCourseNo = appendOrderId ? appendCourseNo : 1;

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
      courseNo: activeCourseNo,
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
          courseNo: activeCourseNo,
          seatNo: undefined,
          lineNotes: undefined,
          prepStation: item.prep_station ?? "kitchen",
        },
      ];
    });
    // Flash cart bar so staff see the add without auto-opening the full sheet.
    setCartBump((n) => n + 1);
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
    setCartBump((n) => n + 1);
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
      setCovers("");
      setAppendOrderId(null);
      setAppendCourseNo(1);
      return;
    }
    const existing = openTickets.find((t) => t.table_id === nextTableId);
    if (existing) {
      beginAppend(existing);
      return;
    }
    setAppendOrderId(null);
    setAppendCourseNo(1);
    setCourseCount("1");
    if (!saleKind) setSaleKind("table");
    else if (saleKind === "counter" || saleKind === "room") {
      // Seating from floor under non-table sale: switch context to table.
      setSaleKind("table");
      setSettleMode("cash");
    }
    setTableId(nextTableId);
    if (!covers) setCovers(String(seats));
    const table = tables.find((t) => t.id === nextTableId);
    if (table?.outlet) {
      setMenuOutlet(table.outlet);
      setCategory("all");
      setMenuUnlocked(false);
      setFloorOutlet(table.outlet);
      pruneCartToOutlet(table.outlet);
    }
    if (
      !customerName.trim() ||
      customerName === "Walk-in" ||
      customerName === "In-house guest"
    ) {
      setCustomerName(table?.name ? `Table ${table.name}` : "Table guest");
    }
    setSection("menu");
  }

  function beginAppend(ticket: OpenPosTicket) {
    if (!canAddItemsToOpenTicket(ticket)) {
      setTicketsOpen(false);
      setSettleTarget(ticket.id);
      return;
    }
    const next = nextCourseNoForTicket(ticket);
    setAppendOrderId(ticket.id);
    setAppendCourseNo(next);
    setCourseCount(String(next));
    setCart([]);
    setPromoCode("");
    setManagerPin("");
    setTicketsOpen(false);
    setCartSheetOpen(false);

    if (ticket.table_id) {
      setSaleKind("table");
      setSettleMode("cash");
      setTableId(ticket.table_id);
      const table = tables.find((t) => t.id === ticket.table_id);
      setCovers(
        ticket.covers
          ? String(ticket.covers)
          : table
            ? String(table.seats)
            : "",
      );
      if (table?.outlet) {
        setMenuOutlet(table.outlet);
        setCategory("all");
        setMenuUnlocked(false);
        setFloorOutlet(table.outlet);
      }
      setCustomerName(
        ticket.customer_name ||
          (table?.name ? `Table ${table.name}` : "Table guest"),
      );
    } else {
      setSaleKind("counter");
      setSettleMode("cash");
      setTableId("");
      setCovers("");
      setCustomerName(ticket.customer_name || "Walk-in");
    }
    setPhone(ticket.phone === "walk-in" ? "" : ticket.phone);
    setSection("menu");
  }

  function cancelAppend() {
    setAppendOrderId(null);
    setAppendCourseNo(1);
    setCourseCount("1");
    setCart([]);
    setManagerPin("");
    if (saleKind === "table") {
      setTableId("");
      setCovers("");
      setSection("floor");
    }
  }

  const openTicketOnTable = useMemo(
    () =>
      tableId
        ? (openTickets.find((t) => t.table_id === tableId) ?? null)
        : null,
    [openTickets, tableId],
  );

  const appendTicket = useMemo(
    () =>
      appendOrderId
        ? (openTickets.find((t) => t.id === appendOrderId) ?? null)
        : null,
    [openTickets, appendOrderId],
  );
  const sentLines = useMemo(
    () =>
      (appendTicket?.order_items ?? []).map((i) => ({
        id: i.id,
        name: i.name_snapshot,
        qty: i.qty,
        courseNo: i.course_no,
      })),
    [appendTicket],
  );

  function closeVoidDialog() {
    setVoidTarget(null);
    setVoidItemId(null);
  }

  function beginVoid(orderId: string, itemId: string | null = null) {
    setVoidSession((n) => n + 1);
    setVoidItemId(itemId);
    setVoidTarget(orderId);
  }

  /** Clear seat context; if a live ticket holds the table, open void instead. */
  function releaseTable() {
    if (appendOrderId) {
      cancelAppend();
      return;
    }
    if (!tableId) return;
    if (openTicketOnTable) {
      beginVoid(openTicketOnTable.id);
      return;
    }
    const occupied =
      tables.find((t) => t.id === tableId)?.status === "occupied";
    if (occupied) {
      const fd = new FormData();
      fd.set("table_id", tableId);
      fd.set("status", "free");
      startTransition(() => {
        void updateTableStatus({ ok: false }, fd);
      });
    }
    setTableId("");
    setCovers("");
    if (saleKind === "table") {
      setSection("floor");
    }
  }

  function selectRoom(nextRoomUnitId: string) {
    setRoomUnitId(nextRoomUnitId);
    if (!nextRoomUnitId) {
      setBookingId("");
      setBookingGuestId("");
      return;
    }
    if (!saleKind) setSaleKind("room");
    setSettleMode("room_charge");
    const booking = bookings.find((candidate) =>
      candidate.rooms.some((room) => room.id === nextRoomUnitId),
    );
    if (!booking) return;
    setBookingId(booking.id);
    setBookingGuestId("");
    setCustomerName(booking.contact_name ?? "In-house guest");
    setPhone(booking.contact_phone ?? "");
    setSection("menu");
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

  function handleHeaderSection(next: PosSection) {
    if (next === "floor") {
      if (saleKind !== "table") startSaleKind("table");
      else setSection("floor");
      return;
    }
    if (next === "menu" && !saleKind) {
      // Stay on gate — section menu with no kind still shows the start cards.
      setSection("menu");
      return;
    }
    setSection(next);
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
        courseNo: appendOrderId ? appendCourseNo : l.courseNo,
        seatNo: l.seatNo,
        lineNotes: l.lineNotes,
        isNc: l.isNc || undefined,
        ncReasonCode: l.ncReasonCode,
      })),
    [cart, appendOrderId, appendCourseNo],
  );

  const totals = useMemo(() => {
    const lines = cart.map((line) => ({
      qty: line.qty,
      unitPriceBtn: line.unitPriceBtn,
      gstApplicable: line.gstApplicable,
      isNc: Boolean(line.isNc),
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

  function toggleNc(key: string) {
    const defaultReason = ncReasons[0]?.code ?? "service_recovery";
    setCart((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        if (line.isNc) {
          return { ...line, isNc: false, ncReasonCode: undefined };
        }
        return { ...line, isNc: true, ncReasonCode: defaultReason };
      }),
    );
  }

  const lineCount = cart.reduce((sum, l) => sum + l.qty, 0);

  const shellClass = cssFullscreen
    ? "erp pos-fs-shell flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
    : "erp flex min-h-[calc(100dvh-5.5rem)] flex-col gap-2";

  // Print KOT only after create/send persisted (I3).
  const kotPrintedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!createState.ok || !createState.orderId) return;
    if (kotPrintedRef.current === createState.orderId) return;
    kotPrintedRef.current = createState.orderId;
    routeKotPrintOnSend(createState.orderId);
  }, [createState.ok, createState.orderId]);

  async function handleBarcodeScan(code: string) {
    // Fast path: local sell_barcode
    const local = items.find(
      (m) => m.sell_barcode && m.sell_barcode.trim() === code,
    );
    if (local) {
      addItemQuick(local.id);
      return;
    }
    const res = await resolvePosBarcode(code);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    addItemQuick(res.menuItemId);
  }

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
        onAddItems={(id) => {
          const ticket = openTickets.find((t) => t.id === id);
          if (ticket) beginAppend(ticket);
        }}
        onVoid={(id) => {
          setTicketsOpen(false);
          beginVoid(id);
        }}
        canFireKot={canFireKot}
        onInvalidate={patchTicketsFromNetwork}
      />
      <SettlePanel
        orderId={settleTarget}
        onOpenChange={(open) => !open && setSettleTarget(null)}
        bookings={bookings}
        creditAgents={creditAgents}
        liveTickets={
          shiftCloseSummary?.openTickets?.length
            ? [
                ...openTickets,
                ...shiftCloseSummary.openTickets.filter(
                  (t) => !openTickets.some((o) => o.id === t.id),
                ),
              ]
            : openTickets
        }
        tenderMethods={runtimeConfig.tenderMethods}
      />
      <VoidReasonDialog
        key={voidSession}
        orderId={voidTarget}
        orderItemId={voidItemId}
        onOpenChange={(open) => {
          if (!open) closeVoidDialog();
        }}
        ticket={
          openTickets.find((t) => t.id === voidTarget) ??
          shiftCloseSummary?.openTickets.find((t) => t.id === voidTarget) ??
          null
        }
        voidReasonCodes={runtimeConfig.voidReasonCodes}
        voidManagerThresholdBtn={runtimeConfig.voidManagerThresholdBtn}
      />
      <DiningTableForm
        target={tableFormTarget}
        onOpenChange={(open) => !open && setTableFormTarget(null)}
        defaultOutlet={
          floorOutlet === null
            ? "__shared__"
            : floorOutlet || defaultOutletCode
        }
        outlets={posOutlets}
        existingNames={tables.map((t) => t.name)}
      />
    </>
  );

  const registerChrome = (
    <PosRegisterHeaderChrome
      section={section}
      onSection={handleHeaderSection}
      tableCount={allTables.length}
      openTicketsCount={openTickets.length}
      onOpenTickets={() => setTicketsOpen(true)}
      shiftOpen={Boolean(shift)}
      closingOpenCount={shiftCloseSummary?.openCount ?? 0}
      onOpenHelp={() => setShortcutsOpen(true)}
      cssFullscreen={cssFullscreen}
      onCssFullscreenChange={setCssFullscreen}
      saleActive={Boolean(saleKind)}
      syncChip={
        <DeskSyncChip
          syncing={ticketsSyncing}
          source={ticketsSyncing ? "none" : "network"}
        />
      }
    />
  );

  // Success strip — mirrors the legacy "order on the KOT board" state.
  if (createState.ok && createState.orderId) {
    return (
      <div className={shellClass}>
        {registerChrome}
        {openTickets.length > 0 ? (
          <KitchenTicketStrip
            openTickets={openTickets}
            onOpenTickets={() => setTicketsOpen(true)}
            onInvalidate={patchTicketsFromNetwork}
          />
        ) : null}
        <div
          className="erp rounded-xl border bg-card p-6"
          role="status"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {createState.settleMode === "room_charge" && createState.folioId
              ? "Charged to room"
              : "Ticket saved"}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {createState.settleMode === "room_charge" && createState.folioId
              ? "On the guest folio"
              : "Order sent to prep"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ref{" "}
            <span className="font-mono text-foreground">
              {createState.orderId}
            </span>
            {createState.totalBtn != null
              ? ` · ${formatBtn(createState.totalBtn)}`
              : ""}
            {createState.message ? ` · ${createState.message}` : null}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild variant="citrus" className="h-11">
              <a href="/erp/pos">New ticket</a>
            </Button>
            {createState.folioId ? (
              <Button asChild variant="outline" className="h-11">
                <a href={`/erp/folios/${createState.folioId}`}>Open folio</a>
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

  const sellMode = section === "menu" || section === "floor";

  return (
    <div className={shellClass}>
      {posTrainingMode ? (
        <Alert className="shrink-0 border-amber-500/40 bg-amber-500/10 print:hidden">
          <TriangleAlertIcon className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-950 dark:text-amber-100">
            <Badge variant="outline" className="mr-2 border-amber-600">
              Training
            </Badge>
            Practice till — stock and walk-in ledger posts are skipped.
          </AlertDescription>
        </Alert>
      ) : null}
      <PosBootstrapCacheWriter
        propertyId={propertyId}
        openTickets={openTickets}
        settledTickets={settledTickets}
        menuItemCount={items.length}
        tableCount={tables.length}
      />
      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as PosSection)}
        className="gap-2"
      >
        {registerChrome}

        {section === "stock" || section === "closing" || section === "service" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="text-accent underline-offset-4 hover:underline"
              onClick={() => setSection("menu")}
            >
              ← Back to sell
            </button>
            <span className="capitalize">
              {section === "service" ? "Guest service" : section}
            </span>
          </div>
        ) : null}

        <div className={cn("space-y-2", !sellMode && "hidden")}>
          {!saleKind ? (
            <PosSaleStartGate
              onPick={startSaleKind}
              tableCount={allTables.length}
              roomCount={roomCount}
              openTicketCount={openTickets.length}
              onOpenTickets={() => setTicketsOpen(true)}
              lastKind={lastKindPref}
              onOpenHelp={() => setShortcutsOpen(true)}
            />
          ) : (
            <>
              <TicketHeader
                saleKind={saleKind}
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
                onReleaseTable={releaseTable}
                hasOpenTicketOnTable={
                  Boolean(openTicketOnTable) && !appendOrderId
                }
                onChangeSaleKind={resetSaleContext}
                onSwitchSaleKind={softSwitchSaleKind}
              />

              {appendOrderId ? (
                <Alert>
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {appendTicket?.customer_name || "This ticket"} is on the
                      register. Add from the menu, or void a line on the ticket.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={cancelAppend}
                    >
                      Done
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}

              {openTickets.length > 0 ? (
                <KitchenTicketStrip
                  openTickets={openTickets}
                  onOpenTickets={() => setTicketsOpen(true)}
                  onInvalidate={patchTicketsFromNetwork}
                />
              ) : null}

              {/* Table path without seat: floor takes the whole workspace. */}
              {saleKind === "table" && !tableId ? (
                <PosFloorPlan
                  floor={floorOutlet}
                  onFloorChange={setFloorOutlet}
                  outlets={posOutlets}
                  tables={tables}
                  openTickets={openTickets}
                  selectedTableId={tableId}
                  onSelectTable={selectTable}
                  onAddTable={() => setTableFormTarget({ mode: "create" })}
                  onEditTable={(table) =>
                    setTableFormTarget({ mode: "edit", table })
                  }
                  onOpenTicket={(orderId) => setSettleTarget(orderId)}
                  onAddItems={(orderId) => {
                    const ticket = openTickets.find((t) => t.id === orderId);
                    if (ticket) beginAppend(ticket);
                  }}
                />
              ) : null}

              {saleReady ? (
                <form
                  action={appendOrderId ? appendAction : createAction}
                  className="block"
                >
                  {/* Hidden inputs — contract must match createDeskOrder / appendDeskOrderItems */}
                  {appendOrderId ? (
                    <input
                      type="hidden"
                      name="existing_order_id"
                      value={appendOrderId}
                    />
                  ) : null}
                  <input
                    type="hidden"
                    name="cart"
                    value={JSON.stringify(cartPayload)}
                  />
                  <input type="hidden" name="settle_mode" value={settleMode} />
                  <input type="hidden" name="booking_id" value={bookingId} />
                  <input type="hidden" name="room_unit_id" value={roomUnitId} />
                  <input
                    type="hidden"
                    name="booking_guest_id"
                    value={bookingGuestId}
                  />
                  <input type="hidden" name="table_id" value={tableId} />
                  <input type="hidden" name="covers" value={covers} />
                  <input type="hidden" name="course_count" value={courseCount} />
                  <input
                    type="hidden"
                    name="server_staff_id"
                    value={serverStaffId}
                  />
                  <input
                    type="hidden"
                    name="customer_name"
                    value={customerName}
                  />
                  <input type="hidden" name="phone" value={phone} />
                  <input type="hidden" name="notes" value={notes} />
                  <input
                    type="hidden"
                    name="service_charge_applied"
                    value={applyServiceCharge ? "1" : "0"}
                  />
                  <input
                    type="hidden"
                    name="service_charge_rate"
                    value={servicePercent}
                  />
                  <input
                    type="hidden"
                    name="service_charge_reason"
                    value={serviceReason}
                  />
                  <input type="hidden" name="promo_code" value={promoCode} />
                  <input type="hidden" name="manager_pin" value={managerPin} />

                  {appendOrderId ? (
                    cart.some((l) => l.isNc) ? (
                      <div className="mb-3 max-w-xs">
                        <label className="space-y-1 text-xs">
                          <span className="text-muted-foreground">
                            Manager PIN (required for NC)
                          </span>
                          <input
                            type="password"
                            value={managerPin}
                            onChange={(e) => setManagerPin(e.target.value)}
                            autoComplete="off"
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          />
                        </label>
                      </div>
                    ) : null
                  ) : showPromo || promoCode || cart.some((l) => l.isNc) ? (
                    <div className="mb-2 grid gap-2 rounded-lg border bg-card p-2 sm:grid-cols-2">
                      <label className="space-y-1 text-xs">
                        <span className="text-muted-foreground">Promo code</span>
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) =>
                            setPromoCode(e.target.value.toUpperCase())
                          }
                          placeholder="TIKTOK50"
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-sm uppercase"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-muted-foreground">
                          Manager PIN
                          {cart.some((l) => l.isNc)
                            ? " (required for NC)"
                            : ""}
                        </span>
                        <input
                          type="password"
                          value={managerPin}
                          onChange={(e) => setManagerPin(e.target.value)}
                          autoComplete="off"
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mb-1">
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        onClick={() => setShowPromo(true)}
                      >
                        + Promo code
                      </button>
                    </div>
                  )}

                  {(appendOrderId ? appendState.error : createState.error) ? (
                    <Alert variant="destructive" className="mb-4">
                      <TriangleAlertIcon />
                      <AlertDescription>
                        {appendOrderId
                          ? appendState.error
                          : createState.error}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {/* Cart: compact rail (~17–19.5rem). Menu gets the leftover width. */}
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_clamp(17rem,20vw,19.5rem)]">
                    <div className="min-w-0">
                      <TabsContent
                        value="menu"
                        forceMount
                        className="data-[state=inactive]:hidden"
                      >
                        <div className="grid gap-3 lg:grid-cols-[9.5rem_minmax(0,1fr)] lg:items-start">
                          <aside className="sticky top-14 z-10 hidden max-h-[calc(100dvh-4.5rem)] lg:flex lg:flex-col lg:gap-2">
                            <div className="shrink-0 bg-background/95 pb-1 backdrop-blur-sm">
                              <PosSearch
                                value={search}
                                onChange={setSearch}
                                onBarcode={handleBarcodeScan}
                              />
                            </div>
                            <nav
                              className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]"
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
                                    menuItems.filter((i) => i.category === cat)
                                      .length
                                  }
                                />
                              ))}
                            </nav>
                          </aside>

                          <div className="min-w-0">
                            <div className="mb-3 flex flex-col gap-2 lg:hidden">
                              <PosSearch
                              value={search}
                              onChange={setSearch}
                              onBarcode={handleBarcodeScan}
                            />
                              {lockedMenuOutlet ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                      {lockedMenuLabel}
                                    </span>{" "}
                                    only
                                  </p>
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                                    onClick={() => {
                                      setMenuUnlocked(true);
                                      setMenuOutlet("all");
                                    }}
                                  >
                                    Show all
                                  </button>
                                </div>
                              ) : naturalTableOutlet && menuUnlocked ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs text-amber-800/90">
                                    Full menu unlocked
                                  </p>
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                                    onClick={() => {
                                      setMenuUnlocked(false);
                                      setMenuOutlet(naturalTableOutlet);
                                      setCategory("all");
                                      pruneCartToOutlet(naturalTableOutlet);
                                    }}
                                  >
                                    Lock floor
                                  </button>
                                </div>
                              ) : (
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
                                      onClick={() =>
                                        setMenuOutletFilter(o.value)
                                      }
                                      label={o.label}
                                    />
                                  ))}
                                </div>
                              )}
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

                            {lockedMenuOutlet ? (
                              <div className="mb-3 hidden flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground lg:flex">
                                <p className="min-w-0 flex-1">
                                  Showing{" "}
                                  <span className="font-medium text-foreground">
                                    {lockedMenuLabel}
                                  </span>{" "}
                                  menu only (this table’s floor).
                                </p>
                                <button
                                  type="button"
                                  className="shrink-0 font-medium text-accent underline-offset-4 hover:underline"
                                  onClick={() => {
                                    setMenuUnlocked(true);
                                    setMenuOutlet("all");
                                  }}
                                >
                                  Show all menus
                                </button>
                              </div>
                            ) : naturalTableOutlet && menuUnlocked ? (
                              <div className="mb-3 hidden flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground lg:flex">
                                <p className="min-w-0 flex-1">
                                  Full menu unlocked for this table.
                                </p>
                                <button
                                  type="button"
                                  className="shrink-0 font-medium text-accent underline-offset-4 hover:underline"
                                  onClick={() => {
                                    setMenuUnlocked(false);
                                    setMenuOutlet(naturalTableOutlet);
                                    setCategory("all");
                                    pruneCartToOutlet(naturalTableOutlet);
                                  }}
                                >
                                  Lock to{" "}
                                  {posOutlets.find(
                                    (o) => o.value === naturalTableOutlet,
                                  )?.label ?? naturalTableOutlet}
                                </button>
                              </div>
                            ) : (
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
                                    onClick={() =>
                                      setMenuOutletFilter(o.value)
                                    }
                                    label={o.label}
                                  />
                                ))}
                              </div>
                            )}

                            <MenuGrid
                              items={menuItems}
                              category={category}
                              search={search}
                              onAdd={addItemQuick}
                              onEditLine={editLine}
                              className="pb-[calc(5.5rem_+_4rem_+_env(safe-area-inset-bottom,0px))] lg:pb-0"
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
                          floor={floorOutlet}
                          onFloorChange={setFloorOutlet}
                          outlets={posOutlets}
                          tables={tables}
                          openTickets={openTickets}
                          selectedTableId={tableId}
                          onSelectTable={selectTable}
                          onAddTable={() =>
                            setTableFormTarget({ mode: "create" })
                          }
                          onEditTable={(table) =>
                            setTableFormTarget({ mode: "edit", table })
                          }
                          onOpenTicket={(orderId) => setSettleTarget(orderId)}
                          onAddItems={(orderId) => {
                            const ticket = openTickets.find(
                              (t) => t.id === orderId,
                            );
                            if (ticket) beginAppend(ticket);
                          }}
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
                        onToggleNc={toggleNc}
                        ncReasons={ncReasons}
                        canFireKot={canFireKot}
                        idPrefix="cart_desktop"
                        appendCourseNo={
                          appendOrderId ? appendCourseNo : undefined
                        }
                        sentLines={sentLines}
                        onVoidSentLine={(itemId) => {
                          if (!appendOrderId) return;
                          beginVoid(appendOrderId, itemId);
                        }}
                      />
                    </aside>
                  </div>

                  {/*
                    Mobile cart dock — MUST sit above DeskMobileNav (h-16 + safe).
                    Prior bug: bottom ~0.75rem + z-30 hid the bar under z-40 tabs.
                  */}
                  <div className="lg:hidden">
                    {(lineCount > 0 || sentLines.length > 0) ? (
                      <button
                        type="button"
                        onClick={() => setCartSheetOpen(true)}
                        key={cartBump}
                        className={cn(
                          "fixed inset-x-3 z-[45] flex h-14 items-center justify-between rounded-xl bg-primary px-4 text-primary-foreground shadow-[0_12px_32px_-12px_rgba(8,47,73,0.55)]",
                          // Above desk tab bar (4rem + safe) + 0.5rem gap
                          "bottom-[calc(4rem_+_env(safe-area-inset-bottom,0px)+_0.5rem)]",
                          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
                        )}
                        aria-label={
                          lineCount > 0
                            ? `Open ticket, ${lineCount} item${lineCount === 1 ? "" : "s"}, ${formatBtn(totals.totalBtn)}`
                            : `Open ticket, ${sentLines.length} on bill`
                        }
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-semibold tabular-nums">
                            {lineCount > 0 ? lineCount : sentLines.length}
                          </span>
                          {lineCount > 0 ? "View ticket" : "Edit ticket"}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {lineCount > 0
                            ? formatBtn(totals.totalBtn)
                            : "Void / add"}
                        </span>
                      </button>
                    ) : null}

                    <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
                      <SheetContent
                        side="bottom"
                        portal={false}
                        className="erp z-[60] max-h-[min(90dvh,calc(100dvh_-_4.5rem))] rounded-t-2xl p-0 sm:max-w-full"
                      >
                        <SheetHeader className="sr-only">
                          <SheetTitle>Ticket</SheetTitle>
                        </SheetHeader>
                        <div className="max-h-[min(85dvh,calc(100dvh_-_5rem))] overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
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
                            onToggleNc={toggleNc}
                            ncReasons={ncReasons}
                            canFireKot={canFireKot}
                            idPrefix="cart_mobile"
                            appendCourseNo={
                              appendOrderId ? appendCourseNo : undefined
                            }
                            sentLines={sentLines}
                            onVoidSentLine={(itemId) => {
                              if (!appendOrderId) return;
                              beginVoid(appendOrderId, itemId);
                            }}
                          />
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </form>
              ) : saleKind === "room" && !roomUnitId ? (
                <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  Choose an in-house room in the context bar — then the menu
                  opens for room charge.
                </p>
              ) : null}
            </>
          )}
        </div>

        <TabsContent value="stock">
          <PosStockPanel items={items} />
        </TabsContent>
        <TabsContent value="closing">
          <PosClosingPanel
            shift={shift}
            closeSummary={shiftCloseSummary}
            onSettleTicket={(id) => setSettleTarget(id)}
            onVoidTicket={(id) => {
              beginVoid(id);
            }}
          />
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
        defaultCourseNo={activeCourseNo}
      />

      <PosHowToSheet
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
