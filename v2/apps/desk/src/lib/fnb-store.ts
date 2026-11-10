import {
  assertCashTender,
  assertVoidPin,
  settleFiscalForTender,
  splitAmount,
} from "@hos-v2/domain";
import { create } from "zustand";
import {
  apiGet,
  isOpsDbUnavailable,
  newIdempotencyKey,
  runCommand,
  sessionPropertyId,
} from "./api";
import { deskManagerExpectedPin, verifyDeskManagerPin } from "./desk-pin";
import { taxBreakdown, useFrontOfficeStore } from "./front-office-store";

/** Staff-readable POS errors — never toast raw Zod / API_UNREACHABLE codes. */
export function humanizePosError(error: string): string {
  const e = error.trim();
  if (e === "API_UNREACHABLE") {
    return "POS server unreachable — check connection and try again";
  }
  if (e === "DATABASE_REQUIRED" || e === "PROPERTY_NOT_FOUND") {
    return "Property catalog not ready — refresh and retry";
  }
  if (e === "SHIFT_OPEN" || /already open/i.test(e)) {
    return "Shift already open for this outlet";
  }
  if (/invalid uuid|uuid/i.test(e)) {
    return "Outlet ID invalid — refresh the page to reload catalog";
  }
  if (/Expected|Zod|Validation|invalid_type|too_small/i.test(e)) {
    return "Could not open shift — check outlet and float amount";
  }
  if (e.length > 120) return `${e.slice(0, 117)}…`;
  return e || "POS action failed";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Deterministic UUID for legacy `m-*` catalog keys so pos.addItem always runs. */
export function menuIdToUuid(id: string): string {
  if (UUID_RE.test(id)) return id;
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  const tail = `${hex}${id.replace(/[^a-f0-9]/gi, "")}000000`.slice(0, 12);
  return `10000000-0000-4000-8000-${tail}`;
}

async function ensureApiOrderId(input: {
  existingOrderId: string | null;
  outletId: string;
  tableLabel: string;
  coverCount: number;
  bookingId: string | null;
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  if (input.existingOrderId && UUID_RE.test(input.existingOrderId)) {
    return { ok: true, orderId: input.existingOrderId };
  }
  const open = await runCommand<{ id: string }>("pos.openOrder", {
    outletId: input.outletId,
    tableLabel: input.tableLabel,
    coverCount: input.coverCount,
    bookingId: input.bookingId,
    idempotencyKey: newIdempotencyKey(),
  });
  if (!open.ok) return { ok: false, error: open.error };
  return { ok: true, orderId: open.data.id };
}

async function syncPosOrderToApi(input: {
  orderId: string | null;
  outletId: string;
  tableLabel: string;
  coverCount: number;
  bookingId: string | null;
  cart: { menuItemId: string; qty: number; note?: string }[];
  fire: boolean;
  settle?: {
    tender: string;
    cashGivenBtn?: number;
    managerPin?: string;
  };
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const opened = await ensureApiOrderId({
    existingOrderId: input.orderId,
    outletId: input.outletId,
    tableLabel: input.tableLabel,
    coverCount: input.coverCount,
    bookingId: input.bookingId,
  });
  if (!opened.ok) return opened;
  const orderId = opened.orderId;
  for (const line of input.cart) {
    const menuItemId = menuIdToUuid(line.menuItemId);
    const added = await runCommand("pos.addItem", {
      orderId,
      menuItemId,
      qty: line.qty,
      note: line.note,
      idempotencyKey: newIdempotencyKey(),
    });
    if (!added.ok) {
      return { ok: false, error: added.error };
    }
  }
  if (input.fire) {
    const fired = await runCommand("pos.fire", {
      orderId,
      idempotencyKey: newIdempotencyKey(),
    });
    if (!fired.ok) return { ok: false, error: fired.error };
  }
  if (input.settle) {
    const settled = await runCommand("pos.settle", {
      orderId,
      tender: input.settle.tender,
      cashGivenBtn: input.settle.cashGivenBtn,
      bookingId: input.bookingId,
      managerPin: input.settle.managerPin,
      idempotencyKey: newIdempotencyKey(),
    });
    if (!settled.ok) return { ok: false, error: settled.error };
  }
  return { ok: true, orderId };
}

export type PosCategory =
  | "bar"
  | "restaurant"
  | "cafe"
  | "room_service"
  | "banquet";

export type DietaryFlag =
  | "veg"
  | "non_veg"
  | "vegan"
  | "jain"
  | "gluten_free"
  | "alcohol";

export type KdsStation = "kitchen" | "bar" | "bakery" | "pass";

export type KotStatus = "queued" | "preparing" | "ready" | "bumped" | "cancelled";

export type PosTender =
  | "cash"
  | "card"
  | "rma_qr"
  | "city_ledger"
  | "room_charge"
  | "agent";

export type PosOutlet = { id: string; code: string; name: string };

export type DiningTable = {
  id: string;
  label: string;
  seats: number;
  status: "free" | "seated" | "billed";
};

export type MenuItem = {
  id: string;
  name: string;
  category: PosCategory;
  station: KdsStation;
  netPrice: number;
  dietary: DietaryFlag[];
  portion?: string;
  alcoholAbv?: string;
  emoji: string;
  popular?: boolean;
};

export type CartLine = {
  key: string;
  menuItemId: string;
  name: string;
  station: KdsStation;
  qty: number;
  netUnit: number;
  note?: string;
};

export type KotLine = {
  menuItemId: string;
  name: string;
  qty: number;
  note?: string;
};

export type KotTicket = {
  id: string;
  ticketNo: string;
  station: KdsStation;
  status: KotStatus;
  createdAt: number;
  bumpedAt: number | null;
  tableLabel: string;
  roomNumber: string | null;
  guestName: string | null;
  lines: KotLine[];
  orderId: string;
};

export type SettledOrder = {
  id: string;
  billNo: string;
  /** Fiscal INV issued only for walk-in tenders — never for room_charge. */
  issueInv: boolean;
  settledAt: string;
  tender: PosTender;
  tableLabel: string;
  roomNumber: string | null;
  stayId: string | null;
  guestName: string | null;
  net: number;
  sc: number;
  bst: number;
  total: number;
  paid: number;
  changeGiven: number;
  lines: { name: string; qty: number; netUnit: number }[];
};

export type PosShift = {
  id: string;
  outletId: string;
  status: "open" | "closed";
  openedAt: string;
  openingFloatBtn: number;
};

export type HeldCheck = {
  id: string;
  label: string;
  tableLabel: string;
  coverCount: number;
  selectedStayId: string | null;
  cart: CartLine[];
  heldAt: string;
  /** Stashed API order so park/resume keeps a single order identity. */
  apiOrderId: string | null;
};

export const MAX_HELD_CHECKS = 5;

type FnbState = {
  menu: MenuItem[];
  outlets: PosOutlet[];
  outletId: string;
  tables: DiningTable[];
  shift: PosShift | null;
  category: PosCategory;
  search: string;
  cart: CartLine[];
  tableLabel: string;
  coverCount: number;
  selectedStayId: string | null;
  heldChecks: HeldCheck[];
  kots: KotTicket[];
  orders: SettledOrder[];
  kdsStation: KdsStation | "all";
  settleOpen: boolean;
  cashTendered: number;
  splitBtn: number;
  voidPin: string;
  /** Single API order UUID for the open check — fire + settle reuse it. */
  apiOrderId: string | null;
  hydrateCatalog: () => Promise<{ ok: true } | { ok: false; error: string }>;
  setOutletId: (id: string) => void;
  selectTable: (label: string) => void;
  setCategory: (c: PosCategory) => void;
  setSearch: (q: string) => void;
  setTableLabel: (t: string) => void;
  setCoverCount: (n: number) => void;
  setSelectedStayId: (id: string | null) => void;
  setKdsStation: (s: KdsStation | "all") => void;
  setSettleOpen: (open: boolean) => void;
  setCashTendered: (n: number) => void;
  setSplitBtn: (n: number) => void;
  setVoidPin: (pin: string) => void;
  openShift: (
    floatBtn: number,
  ) => Promise<
    { ok: true; offline?: boolean } | { ok: false; error: string }
  >;
  closeShift: (
    closingFloatBtn: number,
  ) => Promise<
    { ok: true; offline?: boolean } | { ok: false; error: string }
  >;
  addToCart: (menuItemId: string) => void;
  bumpQty: (key: string, delta: number) => void;
  setLineNote: (key: string, note: string) => void;
  voidCartLine: (
    key: string,
    pin: string,
  ) => { ok: true } | { ok: false; error: string };
  clearCart: () => void;
  parkCheck: (label?: string) => { ok: true; id: string } | { ok: false; error: string };
  resumeCheck: (id: string) => { ok: true } | { ok: false; error: string };
  discardHeldCheck: (id: string) => { ok: true } | { ok: false; error: string };
  fireKot: () => Promise<
    { ok: true; kotIds: string[] } | { ok: false; error: string }
  >;
  bumpKot: (
    kotId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  recallKot: (
    kotId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  mark86: (
    menuItemId: string,
    eightySixed: boolean,
  ) => { ok: true } | { ok: false; error: string };
  settle: (
    tender: PosTender,
    opts?: { cashGiven?: number; pinConfirmed?: boolean },
  ) => Promise<
    { ok: true; billNo: string; issueInv: boolean } | { ok: false; error: string }
  >;
};

/** Valid UUID hex only (never letter `o` — Zod rejects and POS toasts blow up). */
const DEFAULT_OUTLETS: PosOutlet[] = [
  { id: "10000000-0000-4000-8000-0000000000a1", code: "REST", name: "Main Restaurant" },
  { id: "10000000-0000-4000-8000-0000000000a2", code: "BAR", name: "Lobby Bar" },
];

const DEFAULT_TABLES: DiningTable[] = [
  { id: "t1", label: "T-01", seats: 2, status: "free" },
  { id: "t2", label: "T-02", seats: 4, status: "free" },
  { id: "t3", label: "T-04", seats: 4, status: "free" },
  { id: "t4", label: "T-08", seats: 6, status: "free" },
  { id: "t5", label: "Bar-1", seats: 2, status: "free" },
  { id: "t6", label: "Bar-2", seats: 2, status: "free" },
  { id: "t7", label: "RS", seats: 1, status: "free" },
];

export const CATEGORIES: { id: PosCategory; label: string }[] = [
  { id: "restaurant", label: "Restaurant" },
  { id: "bar", label: "Bar" },
  { id: "cafe", label: "Cafe" },
  { id: "room_service", label: "Room Service" },
  { id: "banquet", label: "Banquet" },
];

export const STATIONS: { id: KdsStation; label: string }[] = [
  { id: "kitchen", label: "Kitchen" },
  { id: "bar", label: "Bar" },
  { id: "bakery", label: "Bakery" },
  { id: "pass", label: "Service Pass" },
];

/** Catalog prices are server-authoritative — UI never overrides netPrice on add. */
const MENU = [
  {
    id: "10000000-0000-4000-8000-000000000101",
    name: "Ema Datshi",
    category: "restaurant" as const,
    station: "kitchen" as const,
    netPrice: 380,
    dietary: ["veg"],
    portion: "Bowl",
    emoji: "🌶️",
    popular: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000102",
    name: "Shakam Paa",
    category: "restaurant",
    station: "kitchen",
    netPrice: 450,
    dietary: ["non_veg"],
    portion: "Plate",
    emoji: "🥩",
    popular: true,
  },
  {
    id: "m-phaksha",
    name: "Phaksha Paa",
    category: "restaurant",
    station: "kitchen",
    netPrice: 420,
    dietary: ["non_veg"],
    portion: "Plate",
    emoji: "🥓",
  },
  {
    id: "m-kewa",
    name: "Kewa Datshi",
    category: "restaurant",
    station: "kitchen",
    netPrice: 320,
    dietary: ["veg"],
    portion: "Bowl",
    emoji: "🥔",
  },
  {
    id: "m-jasha",
    name: "Jasha Maru",
    category: "restaurant",
    station: "kitchen",
    netPrice: 400,
    dietary: ["non_veg"],
    portion: "Bowl",
    emoji: "🍗",
  },
  {
    id: "10000000-0000-4000-8000-000000000104",
    name: "Dal Bhat Set",
    category: "restaurant",
    station: "kitchen",
    netPrice: 350,
    dietary: ["veg"],
    portion: "Thali",
    emoji: "🍚",
    popular: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000103",
    name: "Beef Momos (6)",
    category: "restaurant",
    station: "kitchen",
    netPrice: 280,
    dietary: ["non_veg"],
    portion: "6 pcs",
    emoji: "🥟",
    popular: true,
  },
  {
    id: "m-veg-momos",
    name: "Veg Momos (6)",
    category: "restaurant",
    station: "kitchen",
    netPrice: 240,
    dietary: ["veg", "jain"],
    portion: "6 pcs",
    emoji: "🥟",
  },
  {
    id: "m-thukpa",
    name: "Thukpa",
    category: "restaurant",
    station: "kitchen",
    netPrice: 300,
    dietary: ["non_veg"],
    portion: "Bowl",
    emoji: "🍜",
  },
  {
    id: "m-salad",
    name: "Himalayan Greens",
    category: "restaurant",
    station: "pass",
    netPrice: 220,
    dietary: ["vegan", "gluten_free"],
    portion: "Plate",
    emoji: "🥗",
  },
  {
    id: "10000000-0000-4000-8000-000000000201",
    name: "Red Panda Lager",
    category: "bar",
    station: "bar",
    netPrice: 180,
    dietary: ["alcohol"],
    portion: "330ml",
    alcoholAbv: "5.0%",
    emoji: "🍺",
    popular: true,
  },
  {
    id: "m-druk",
    name: "Druk 11000",
    category: "bar",
    station: "bar",
    netPrice: 200,
    dietary: ["alcohol"],
    portion: "650ml",
    alcoholAbv: "8.0%",
    emoji: "🍻",
  },
  {
    id: "m-ara",
    name: "Ara (house)",
    category: "bar",
    station: "bar",
    netPrice: 150,
    dietary: ["alcohol"],
    portion: "60ml",
    alcoholAbv: "40%",
    emoji: "🥃",
  },
  {
    id: "m-wine",
    name: "Bhutanese Wine Glass",
    category: "bar",
    station: "bar",
    netPrice: 350,
    dietary: ["alcohol"],
    portion: "150ml",
    alcoholAbv: "12%",
    emoji: "🍷",
  },
  {
    id: "m-whisky",
    name: "Black Label Pour",
    category: "bar",
    station: "bar",
    netPrice: 650,
    dietary: ["alcohol"],
    portion: "30ml",
    alcoholAbv: "40%",
    emoji: "🥃",
  },
  {
    id: "10000000-0000-4000-8000-000000000202",
    name: "Fresh Lime Soda",
    category: "bar",
    station: "bar",
    netPrice: 120,
    dietary: ["vegan"],
    portion: "Glass",
    emoji: "🍋",
  },
  {
    id: "10000000-0000-4000-8000-000000000301",
    name: "Suja (Butter Tea)",
    category: "cafe",
    station: "pass",
    netPrice: 80,
    dietary: ["veg"],
    portion: "Cup",
    emoji: "🍵",
    popular: true,
  },
  {
    id: "m-ngaja",
    name: "Ngaja (Sweet Tea)",
    category: "cafe",
    station: "pass",
    netPrice: 60,
    dietary: ["veg"],
    portion: "Cup",
    emoji: "☕",
  },
  {
    id: "m-espresso",
    name: "Espresso",
    category: "cafe",
    station: "pass",
    netPrice: 140,
    dietary: ["veg"],
    portion: "Single",
    emoji: "☕",
  },
  {
    id: "10000000-0000-4000-8000-000000000302",
    name: "Butter Croissant",
    category: "cafe",
    station: "bakery",
    netPrice: 160,
    dietary: ["veg"],
    portion: "1 pc",
    emoji: "🥐",
  },
  {
    id: "m-cake",
    name: "Walnut Brownie",
    category: "cafe",
    station: "bakery",
    netPrice: 180,
    dietary: ["veg"],
    portion: "Slice",
    emoji: "🍫",
  },
  {
    id: "10000000-0000-4000-8000-000000000401",
    name: "RS · MAP Dinner Tray",
    category: "room_service",
    station: "kitchen",
    netPrice: 850,
    dietary: ["non_veg"],
    portion: "Tray",
    emoji: "🛎️",
    popular: true,
  },
  {
    id: "10000000-0000-4000-8000-3540980cbeaf",
    name: "Box Breakfast · Packed",
    category: "room_service",
    station: "kitchen",
    netPrice: 450,
    dietary: ["veg"],
    portion: "Packed",
    emoji: "🥡",
    popular: true,
  },
  {
    id: "m-rs-breakfast",
    name: "RS · CP Breakfast",
    category: "room_service",
    station: "kitchen",
    netPrice: 450,
    dietary: ["veg"],
    portion: "Tray",
    emoji: "🍳",
  },
  {
    id: "m-rs-fruit",
    name: "RS · Fruit Platter",
    category: "room_service",
    station: "pass",
    netPrice: 280,
    dietary: ["vegan", "gluten_free"],
    portion: "Plate",
    emoji: "🍇",
  },
  {
    id: "m-banq-buffet",
    name: "Banquet Buffet /pax",
    category: "banquet",
    station: "kitchen",
    netPrice: 1200,
    dietary: ["non_veg"],
    portion: "Per pax",
    emoji: "🍽️",
  },
  {
    id: "m-banq-tea",
    name: "Conference Tea Set",
    category: "banquet",
    station: "pass",
    netPrice: 180,
    dietary: ["veg"],
    portion: "Per pax",
    emoji: "🫖",
  },
  {
    id: "m-banq-veg",
    name: "Jain Banquet Plate",
    category: "banquet",
    station: "kitchen",
    netPrice: 950,
    dietary: ["jain", "veg"],
    portion: "Plate",
    emoji: "🟢",
  },
].map((item) => ({ ...item, id: menuIdToUuid(item.id) })) as MenuItem[];

let ticketSeq = 240;
let billSeq = 880;
let orderSeq = 100;

function cartTotals(cart: CartLine[]) {
  const net = cart.reduce((s, l) => s + l.netUnit * l.qty, 0);
  const tax = taxBreakdown(net);
  return {
    net: tax.netAmount,
    sc: tax.scAmount,
    bst: tax.bstAmount,
    total: tax.totalAmount,
  };
}

export function elapsedMs(createdAt: number, now = Date.now()): number {
  return Math.max(0, now - createdAt);
}

export function timerTone(ms: number): "green" | "amber" | "red" {
  const mins = ms / 60_000;
  if (mins < 10) return "green";
  if (mins < 20) return "amber";
  return "red";
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatNu(n: number): string {
  return `Nu. ${Math.round(n).toLocaleString("en-BT")}`;
}

/** Live POS never paints hardcoded MENU; opt-in via VITE_POS_SEED=1 in DEV. */
const LIVE_POS_BOOT = !import.meta.env.DEV;
const ALLOW_POS_SEED =
  import.meta.env.DEV && String(import.meta.env.VITE_POS_SEED ?? "") === "1";

export const useFnbStore = create<FnbState>((set, get) => ({
  menu: LIVE_POS_BOOT || !ALLOW_POS_SEED ? [] : MENU,
  outlets: DEFAULT_OUTLETS,
  outletId: DEFAULT_OUTLETS[0].id,
  tables: DEFAULT_TABLES,
  shift: null,
  apiOrderId: null,
  category: "restaurant",
  search: "",
  cart: [],
  tableLabel: "T-01",
  coverCount: 2,
  selectedStayId: null,
  heldChecks: [],
  kots: [],
  orders: [],
  kdsStation: "all",
  settleOpen: false,
  cashTendered: 0,
  splitBtn: 0,
  voidPin: "",

  hydrateCatalog: async () => {
    try {
      const snap = await apiGet<{
        ok: boolean;
        outlets: PosOutlet[];
        menu: {
          id: string;
          name: string;
          category: string;
          station: string;
          netPrice: number;
          eightySixed: boolean;
        }[];
        shift: PosShift | null;
      }>(`/v1/pos/catalog?propertyId=${sessionPropertyId()}`);
      const localById = new Map(MENU.map((m) => [m.id, m]));
      const merged: MenuItem[] = snap.menu.map((m) => {
        const local = localById.get(m.id);
        return {
          id: m.id,
          name: m.name,
          category: (m.category as PosCategory) || "restaurant",
          station: (m.station as KdsStation) || "kitchen",
          netPrice: m.netPrice,
          dietary: local?.dietary ?? ["veg"],
          portion: local?.portion,
          emoji: local?.emoji ?? "🍽️",
          popular: local?.popular,
          alcoholAbv: local?.alcoholAbv,
        };
      });
      for (const m of MENU) {
        if (!merged.some((x) => x.id === m.id)) merged.push(m);
      }
      const outletsRaw = snap.outlets.length ? snap.outlets : DEFAULT_OUTLETS;
      const outlets = outletsRaw.every((o) => UUID_RE.test(o.id))
        ? outletsRaw
        : DEFAULT_OUTLETS;
      set({
        outlets,
        outletId: outlets[0]?.id ?? DEFAULT_OUTLETS[0]!.id,
        menu: merged,
        shift: snap.shift,
      });
      const kds = await apiGet<{
        ok: boolean;
        tickets: {
          id: string;
          ticketNo: string;
          station: string;
          status: string;
          tableLabel: string;
          createdAt: number;
          orderId: string;
          lines: { menuItemId: string; name: string; qty: number; note?: string }[];
        }[];
      }>(`/v1/kds/tickets?propertyId=${sessionPropertyId()}`);
      set({
        kots: kds.tickets.map((t) => ({
          id: t.id,
          ticketNo: t.ticketNo,
          station: t.station as KdsStation,
          status: t.status as KotStatus,
          createdAt: t.createdAt,
          bumpedAt: t.status === "bumped" ? Date.now() : null,
          tableLabel: t.tableLabel,
          roomNumber: null,
          guestName: null,
          orderId: t.orderId,
          lines: t.lines,
        })),
      });
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Catalog hydrate failed",
      };
    }
  },

  setOutletId: (id) => set({ outletId: id }),
  selectTable: (label) =>
    set((s) => ({
      tableLabel: label,
      apiOrderId: null,
      tables: s.tables.map((t) =>
        t.label === label
          ? { ...t, status: t.status === "free" ? "seated" : t.status }
          : t,
      ),
    })),
  setCategory: (c) => set({ category: c }),
  setSearch: (q) => set({ search: q }),
  setTableLabel: (t) => set({ tableLabel: t }),
  setCoverCount: (n) => set({ coverCount: Math.max(1, n) }),
  setSelectedStayId: (id) => set({ selectedStayId: id }),
  setKdsStation: (s) => set({ kdsStation: s }),
  setSettleOpen: (open) => set({ settleOpen: open }),
  setCashTendered: (n) => set({ cashTendered: Math.max(0, n) }),
  setSplitBtn: (n) => set({ splitBtn: Math.max(0, n) }),
  setVoidPin: (pin) => set({ voidPin: pin }),

  openShift: async (floatBtn) => {
    if (get().shift?.status === "open") {
      return { ok: false, error: humanizePosError("Shift already open") };
    }
    let outletId = get().outletId;
    if (!UUID_RE.test(outletId)) {
      outletId = DEFAULT_OUTLETS[0]!.id;
      set({ outletId, outlets: DEFAULT_OUTLETS });
    }
    const remote = await runCommand<{ id: string }>("pos.openShift", {
      outletId,
      openingFloatBtn: floatBtn,
      idempotencyKey: newIdempotencyKey(),
    });
    if (!remote.ok) {
      if (isOpsDbUnavailable(remote.error)) {
        const shift: PosShift = {
          id: crypto.randomUUID(),
          outletId,
          status: "open",
          openedAt: new Date().toISOString(),
          openingFloatBtn: floatBtn,
        };
        set({ shift });
        return { ok: true, offline: true };
      }
      return { ok: false, error: humanizePosError(remote.error) };
    }
    const shift: PosShift = {
      id: remote.data.id ?? crypto.randomUUID(),
      outletId,
      status: "open",
      openedAt: new Date().toISOString(),
      openingFloatBtn: floatBtn,
    };
    set({ shift });
    return { ok: true };
  },

  closeShift: async (closingFloatBtn) => {
    const shift = get().shift;
    if (!shift || shift.status !== "open") {
      return { ok: false, error: humanizePosError("No open shift") };
    }
    if (get().cart.length > 0) {
      return {
        ok: false,
        error: "Settle or clear the open check before closing the shift",
      };
    }
    const remote = await runCommand("pos.closeShift", {
      shiftId: shift.id,
      closingFloatBtn,
      idempotencyKey: newIdempotencyKey(),
    });
    if (!remote.ok) {
      if (isOpsDbUnavailable(remote.error)) {
        set({ shift: { ...shift, status: "closed" } });
        return { ok: true, offline: true };
      }
      return { ok: false, error: humanizePosError(remote.error) };
    }
    set({ shift: { ...shift, status: "closed" } });
    return { ok: true };
  },

  addToCart: (menuItemId) => {
    const item = get().menu.find((m) => m.id === menuItemId);
    if (!item) return;
    set((s) => {
      const existing = s.cart.find((l) => l.menuItemId === menuItemId && !l.note);
      if (existing) {
        return {
          cart: s.cart.map((l) =>
            l.key === existing.key ? { ...l, qty: l.qty + 1 } : l,
          ),
        };
      }
      return {
        cart: [
          ...s.cart,
          {
            key: crypto.randomUUID(),
            menuItemId: item.id,
            name: item.name,
            station: item.station,
            qty: 1,
            netUnit: item.netPrice,
          },
        ],
      };
    });
  },

  bumpQty: (key, delta) => {
    set((s) => ({
      cart: s.cart
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    }));
  },

  setLineNote: (key, note) => {
    set((s) => ({
      cart: s.cart.map((l) => (l.key === key ? { ...l, note: note || undefined } : l)),
    }));
  },

  voidCartLine: (key, pin) => {
    const expected = deskManagerExpectedPin();
    const gate = assertVoidPin({ pinProvided: pin, expectedPin: expected });
    if (!gate.ok) {
      const hr = verifyDeskManagerPin(pin);
      if (!hr.ok) return { ok: false, error: hr.error };
    }
    const line = get().cart.find((l) => l.key === key);
    if (!line) return { ok: false, error: "Line not found" };
    set((s) => ({
      cart: s.cart.filter((l) => l.key !== key),
      voidPin: "",
    }));
    return { ok: true };
  },

  clearCart: () =>
    set({
      cart: [],
      selectedStayId: null,
      cashTendered: 0,
      splitBtn: 0,
      apiOrderId: null,
    }),

  parkCheck: (label) => {
    const state = get();
    if (state.cart.length === 0) return { ok: false, error: "Cart is empty — nothing to hold" };
    if (state.heldChecks.length >= MAX_HELD_CHECKS) {
      return { ok: false, error: `Max ${MAX_HELD_CHECKS} held checks — resume or discard one` };
    }
    const id = crypto.randomUUID();
    const heldAt = new Date().toISOString();
    const timeLabel = new Date(heldAt).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const held: HeldCheck = {
      id,
      label: label?.trim() || `${state.tableLabel} · ${timeLabel}`,
      tableLabel: state.tableLabel,
      coverCount: state.coverCount,
      selectedStayId: state.selectedStayId,
      cart: state.cart.map((l) => ({ ...l })),
      heldAt,
      apiOrderId: state.apiOrderId,
    };
    set({
      heldChecks: [held, ...state.heldChecks],
      cart: [],
      selectedStayId: null,
      cashTendered: 0,
      settleOpen: false,
      apiOrderId: null,
      tableLabel: "T-01",
      coverCount: 2,
    });
    return { ok: true, id };
  },

  resumeCheck: (id) => {
    const state = get();
    const held = state.heldChecks.find((h) => h.id === id);
    if (!held) return { ok: false, error: "Held check not found" };

    let nextHeld = state.heldChecks.filter((h) => h.id !== id);
    if (state.cart.length > 0) {
      if (nextHeld.length >= MAX_HELD_CHECKS) {
        return {
          ok: false,
          error: `Cannot auto-hold current cart — already at ${MAX_HELD_CHECKS} holds`,
        };
      }
      const heldAt = new Date().toISOString();
      const timeLabel = new Date(heldAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      nextHeld = [
        {
          id: crypto.randomUUID(),
          label: `${state.tableLabel} · ${timeLabel}`,
          tableLabel: state.tableLabel,
          coverCount: state.coverCount,
          selectedStayId: state.selectedStayId,
          cart: state.cart.map((l) => ({ ...l })),
          heldAt,
          apiOrderId: state.apiOrderId,
        },
        ...nextHeld,
      ];
    }

    set({
      heldChecks: nextHeld,
      cart: held.cart.map((l) => ({ ...l })),
      tableLabel: held.tableLabel,
      coverCount: held.coverCount,
      selectedStayId: held.selectedStayId,
      apiOrderId: held.apiOrderId,
      cashTendered: 0,
      settleOpen: false,
    });
    return { ok: true };
  },

  discardHeldCheck: (id) => {
    const held = get().heldChecks.find((h) => h.id === id);
    if (!held) return { ok: false, error: "Held check not found" };
    set((s) => ({ heldChecks: s.heldChecks.filter((h) => h.id !== id) }));
    return { ok: true };
  },

  fireKot: async () => {
    const state = get();
    if (state.cart.length === 0) return { ok: false, error: "Cart is empty — add items first" };

    const fo = useFrontOfficeStore.getState();
    const stay = state.selectedStayId
      ? fo.stays.find((st) => st.id === state.selectedStayId)
      : null;
    const bookingId =
      stay?.apiBookingId && UUID_RE.test(stay.apiBookingId)
        ? stay.apiBookingId
        : null;

    const remote = await syncPosOrderToApi({
      orderId: state.apiOrderId,
      outletId: state.outletId,
      tableLabel: state.tableLabel,
      coverCount: state.coverCount,
      bookingId,
      cart: state.cart.map((l) => ({
        menuItemId: l.menuItemId,
        qty: l.qty,
        note: l.note,
      })),
      fire: true,
    });
    if (!remote.ok) return { ok: false, error: remote.error };

    const byStation = new Map<KdsStation, CartLine[]>();
    for (const line of state.cart) {
      const list = byStation.get(line.station) ?? [];
      list.push(line);
      byStation.set(line.station, list);
    }

    orderSeq += 1;
    const now = Date.now();
    const kotIds: string[] = [];
    const newKots: KotTicket[] = [];

    for (const [station, lines] of byStation) {
      ticketSeq += 1;
      const id = crypto.randomUUID();
      kotIds.push(id);
      newKots.push({
        id,
        ticketNo: `KOT-${String(ticketSeq).padStart(4, "0")}`,
        station,
        status: "preparing",
        createdAt: now,
        bumpedAt: null,
        tableLabel: state.tableLabel,
        roomNumber: stay?.roomNumber ?? null,
        guestName: stay?.guestName ?? null,
        orderId: remote.orderId,
        lines: lines.map((l) => ({
          menuItemId: l.menuItemId,
          name: l.name,
          qty: l.qty,
          note: l.note,
        })),
      });
    }

    set((s) => ({
      apiOrderId: remote.orderId,
      kots: [...newKots, ...s.kots],
    }));
    await get().hydrateCatalog();
    return { ok: true, kotIds };
  },

  bumpKot: async (kotId) => {
    const kot = get().kots.find((k) => k.id === kotId);
    if (!kot) return { ok: false, error: "KOT not found" };
    if (kot.status === "bumped") return { ok: false, error: "Already bumped" };
    if (kot.status === "cancelled") return { ok: false, error: "KOT cancelled" };
    if (!UUID_RE.test(kot.id) && !UUID_RE.test(kot.orderId)) {
      return { ok: false, error: "KOT not synced — fire again after API hydrate" };
    }
    const bumped = await runCommand("kds.bump", {
      ticketId: kotId,
      idempotencyKey: newIdempotencyKey(),
    });
    if (!bumped.ok) return { ok: false, error: bumped.error };
    set((s) => ({
      kots: s.kots.map((k) =>
        k.id !== kotId
          ? k
          : { ...k, status: "bumped", bumpedAt: Date.now() },
      ),
    }));
    return { ok: true };
  },

  recallKot: async (kotId) => {
    const kot = get().kots.find((k) => k.id === kotId);
    if (!kot) return { ok: false, error: "KOT not found" };
    const recalled = await runCommand("kds.recall", {
      ticketId: kotId,
      idempotencyKey: newIdempotencyKey(),
    });
    if (!recalled.ok) return { ok: false, error: recalled.error };
    set((s) => ({
      kots: s.kots.map((k) =>
        k.id !== kotId
          ? k
          : { ...k, status: "preparing", bumpedAt: null, createdAt: Date.now() },
      ),
    }));
    return { ok: true };
  },

  mark86: (menuItemId, eightySixed) => {
    const item = get().menu.find((m) => m.id === menuItemId);
    if (!item) return { ok: false, error: "Menu item not found" };
    set((s) => ({
      menu: eightySixed
        ? s.menu.filter((m) => m.id !== menuItemId)
        : s.menu,
    }));
    void runCommand("kds.mark86", {
      menuItemId,
      eightySixed,
      idempotencyKey: newIdempotencyKey(),
    });
    return { ok: true };
  },

  settle: async (tender, opts = {}) => {
    const state = get();
    if (state.cart.length === 0) return { ok: false, error: "Cart is empty" };
    let settleCart = state.cart;
    let totals = cartTotals(settleCart);

    if (state.splitBtn > 0) {
      const split = splitAmount(totals.total, state.splitBtn);
      if (!split.ok) return split;
      // Amount split: settle split portion now; remainder stays in cart as synthetic hold.
      const ratio = split.splitBtn / totals.total;
      settleCart = state.cart.map((l) => ({
        ...l,
        qty: Math.max(1, Math.round(l.qty * ratio)),
      }));
      totals = cartTotals(settleCart);
    }

    if (
      (tender === "city_ledger" || tender === "agent") &&
      !opts.pinConfirmed
    ) {
      return {
        ok: false,
        error: "Agent / city ledger requires manager PIN (HR staff)",
      };
    }

    if (tender === "room_charge") {
      if (!state.selectedStayId) {
        return { ok: false, error: "Select an in-house room before charging" };
      }
      const fo = useFrontOfficeStore.getState();
      const stay = fo.stays.find((s) => s.id === state.selectedStayId);
      if (!stay || stay.status !== "checked_in") {
        return { ok: false, error: "Stay must be checked-in for room charge" };
      }
      if (!stay.apiBookingId || !UUID_RE.test(stay.apiBookingId)) {
        return { ok: false, error: "Stay missing API booking — cannot room charge" };
      }
      // Authority: pos.settle room_charge only — do not also call finance.postCharge.
    }

    if (tender === "cash") {
      const given = opts.cashGiven ?? state.cashTendered;
      const cash = assertCashTender({
        totalBtn: totals.total,
        cashGivenBtn: given,
      });
      if (!cash.ok) return cash;
    }

    const fo = useFrontOfficeStore.getState();
    const stay = state.selectedStayId
      ? fo.stays.find((s) => s.id === state.selectedStayId)
      : null;
    const bookingId =
      stay?.apiBookingId && UUID_RE.test(stay.apiBookingId)
        ? stay.apiBookingId
        : null;
    const cashGiven = opts.cashGiven ?? state.cashTendered;

    const remote = await syncPosOrderToApi({
      orderId: state.apiOrderId,
      outletId: state.outletId,
      tableLabel: state.tableLabel,
      coverCount: state.coverCount,
      bookingId,
      cart: settleCart.map((l) => ({
        menuItemId: l.menuItemId,
        qty: l.qty,
        note: l.note,
      })),
      fire: !state.apiOrderId,
      settle: {
        tender,
        cashGivenBtn: cashGiven,
        managerPin: opts.pinConfirmed
          ? deskManagerExpectedPin()
          : undefined,
      },
    });
    if (!remote.ok) return { ok: false, error: remote.error };

    if (tender === "room_charge" && stay) {
      await fo.hydrateFromApi();
    }

    const fiscal = settleFiscalForTender(tender);
    billSeq += 1;
    const billNo = fiscal.issueInv
      ? `INV-POS-${billSeq}`
      : `FOLIO-POS-${billSeq}`;
    const changeGiven = tender === "cash" ? Math.max(0, cashGiven - totals.total) : 0;

    const order: SettledOrder = {
      id: remote.orderId,
      billNo,
      issueInv: fiscal.issueInv,
      settledAt: new Date().toISOString(),
      tender,
      tableLabel: state.tableLabel,
      roomNumber: stay?.roomNumber ?? null,
      stayId: stay?.id ?? null,
      guestName: stay?.guestName ?? null,
      net: totals.net,
      sc: totals.sc,
      bst: totals.bst,
      total: totals.total,
      paid: tender === "cash" ? cashGiven : totals.total,
      changeGiven,
      lines: settleCart.map((l) => ({
        name: l.name,
        qty: l.qty,
        netUnit: l.netUnit,
      })),
    };

    set((s) => ({
      orders: [order, ...s.orders],
      cart: state.splitBtn > 0 ? state.cart : [],
      splitBtn: 0,
      settleOpen: state.splitBtn > 0,
      cashTendered: 0,
      apiOrderId: state.splitBtn > 0 ? remote.orderId : null,
      selectedStayId: tender === "room_charge" ? s.selectedStayId : null,
      tables: s.tables.map((t) =>
        t.label === state.tableLabel && state.splitBtn <= 0
          ? { ...t, status: "free" as const }
          : t,
      ),
    }));

    return { ok: true, billNo, issueInv: fiscal.issueInv };
  },
}));

export function getCartTotals(cart: CartLine[]) {
  return cartTotals(cart);
}
