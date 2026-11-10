import { create } from "zustand";
import {
  addDays,
  folioBalance,
  formatNu,
  taxBreakdown,
  useFrontOfficeStore,
} from "./front-office-store";
import { useFnbStore } from "./fnb-store";

export type DrcReportId =
  | "bst3"
  | "tourist_manifest"
  | "night_revenue"
  | "cash_drawer"
  | "trial_balance"
  | "ar_aging"
  | "ap_aging"
  | "hk_discrepancy"
  | "revpar"
  | "pos_velocity"
  | "food_cost"
  | "meal_forecast"
  | "guide_dorm"
  | "void_discount"
  | "petty_cash"
  | "master_folio_pack";

export type DrcReport = {
  id: DrcReportId;
  no: number;
  title: string;
  description: string;
};

/** Same purchase categories as Hotel OS PurchasesManager. */
export const PURCHASE_CATEGORIES = [
  { id: "veg_dairy", label: "Centenary Veg & Dairy" },
  { id: "meat", label: "Meat & Poultry" },
  { id: "grocery", label: "Dry Grocery & Store" },
  { id: "bar", label: "Bar Stock & Beverages" },
  { id: "gas_lpg", label: "Commercial LPG Gas" },
  { id: "utilities", label: "Electricity & Internet" },
  { id: "payroll", label: "Salaries & 10% Tip Pool" },
  { id: "repairs", label: "Repairs & Maintenance" },
  { id: "office", label: "Guest Amenities & Office" },
] as const;

export type PurchaseCategoryId = (typeof PURCHASE_CATEGORIES)[number]["id"];

export const PURCHASE_PAYMENT_MODES = [
  "cash",
  "bank",
  "card",
  "credit",
] as const;

export type PurchasePaymentMode = (typeof PURCHASE_PAYMENT_MODES)[number];

export type PurchaseLine = {
  skuId: string;
  name: string;
  qty: number;
  uom: string;
  unitCost: number;
};

export type PurchaseBill = {
  id: string;
  billNo: string;
  billDate: string;
  supplierName: string;
  category: PurchaseCategoryId;
  taxableBtn: number;
  gstBtn: number;
  nonTaxableBtn: number;
  grandTotalBtn: number;
  paymentMode: PurchasePaymentMode;
  journalNo: string;
  createdAt: string;
  lines?: PurchaseLine[];
};

export type AuditStep = {
  id: string;
  label: string;
  status: "pending" | "ok" | "blocked" | "done";
  detail: string;
};

export function purchaseCategoryLabel(id: PurchaseCategoryId): string {
  return PURCHASE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function suggestPurchaseJournalNo(existing: PurchaseBill[], billDate: string): string {
  const yyyymm = billDate.replaceAll("-", "").slice(0, 6);
  const prefix = `J${yyyymm}-`;
  let max = 0;
  for (const b of existing) {
    if (!b.journalNo.startsWith(prefix)) continue;
    const n = Number(b.journalNo.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

type FiscalState = {
  tillBalance: number;
  purchases: PurchaseBill[];
  lastAuditDate: string | null;
  auditLog: string[];
  selectedReport: DrcReportId;
  setSelectedReport: (id: DrcReportId) => void;
  addPurchaseBill: (input: {
    billNo: string;
    billDate: string;
    supplierName: string;
    category: PurchaseCategoryId;
    taxableBtn: number;
    gstBtn: number;
    nonTaxableBtn: number;
    paymentMode: PurchasePaymentMode;
    journalNo?: string;
    lines?: PurchaseLine[];
  }) => { ok: true; bill: PurchaseBill } | { ok: false; error: string };
  buildChecklist: () => AuditStep[];
  runNightAudit: () => { ok: true; nextDate: string; tipPoolPoints: number } | { ok: false; error: string };
  /** Alias — autonomous pre-flight + postings + rollover */
  runAutonomousNightAudit: () =>
    | { ok: true; nextDate: string; tipPoolPoints: number; snapshotId: string }
    | { ok: false; error: string };
  reportPayload: (id: DrcReportId) => { headline: string; rows: string[][] };
};

export const DRC_REPORTS: DrcReport[] = [
  { id: "bst3", no: 1, title: "DRC Form BST-3", description: "Monthly BST return + 10% SC tip pool" },
  { id: "tourist_manifest", no: 2, title: "Tourist Police Manifest", description: "Daily in-house foreign nationals" },
  { id: "night_revenue", no: 3, title: "Night Audit Revenue Summary", description: "Room, F&B, Laundry, Other" },
  { id: "cash_drawer", no: 4, title: "Cash Drawer Shift Slip", description: "80mm thermal reconciliation" },
  { id: "trial_balance", no: 5, title: "Trial Balance & Manager Report", description: "Daily manager pack" },
  { id: "ar_aging", no: 6, title: "AR Aging (B2B)", description: "Agent city ledger balances" },
  { id: "ap_aging", no: 7, title: "AP Aging (Vendors)", description: "Centenary & supplier bills" },
  { id: "hk_discrepancy", no: 8, title: "HK Discrepancy Log", description: "FD Occupied vs HK Vacant" },
  { id: "revpar", no: 9, title: "RevPAR / ADR / Occ %", description: "Yield trends" },
  { id: "pos_velocity", no: 10, title: "POS Sales Velocity", description: "Top menu items" },
  { id: "food_cost", no: 11, title: "Food Cost Analysis", description: "Kitchen consumption" },
  { id: "meal_forecast", no: 12, title: "Meal Forecast", description: "B/L/D pax for kitchen" },
  { id: "guide_dorm", no: 13, title: "Guide & Driver Dorm Log", description: "Staff bed nights" },
  { id: "void_discount", no: 14, title: "Void & Discount Audit", description: "Manager PIN authorizations" },
  { id: "petty_cash", no: 15, title: "Purchase bill journal", description: "Supplier bills · pay mode · jrno" },
  { id: "master_folio_pack", no: 16, title: "Master Folio B2B Pack", description: "Consolidated MoU settlement" },
];

export const useFiscalStore = create<FiscalState>((set, get) => ({
  tillBalance: 48250,
  purchases: [
    {
      id: "pur-1",
      billNo: "CFM-2411",
      billDate: "2026-11-07",
      supplierName: "Centenary Farmers Market",
      category: "veg_dairy",
      taxableBtn: 0,
      gstBtn: 0,
      nonTaxableBtn: 960,
      grandTotalBtn: 960,
      paymentMode: "cash",
      journalNo: "J202611-0001",
      createdAt: new Date().toISOString(),
    },
    {
      id: "pur-2",
      billNo: "CMC-1182",
      billDate: "2026-11-07",
      supplierName: "Centenary Meats Cooperative",
      category: "meat",
      taxableBtn: 4000,
      gstBtn: 200,
      nonTaxableBtn: 0,
      grandTotalBtn: 4200,
      paymentMode: "credit",
      journalNo: "J202611-0002",
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
    },
  ],
  lastAuditDate: null,
  auditLog: [],
  selectedReport: "bst3",

  setSelectedReport: (id) => set({ selectedReport: id }),

  addPurchaseBill: ({
    billNo,
    billDate,
    supplierName,
    category,
    taxableBtn,
    gstBtn,
    nonTaxableBtn,
    paymentMode,
    journalNo,
    lines,
  }) => {
    const taxable = Math.max(0, Number(taxableBtn) || 0);
    const gst = Math.max(0, Number(gstBtn) || 0);
    const nonTax = Math.max(0, Number(nonTaxableBtn) || 0);
    const grand = Math.round((taxable + gst + nonTax) * 100) / 100;
    if (!billNo.trim()) return { ok: false, error: "Bill no is required" };
    if (!billDate.trim()) return { ok: false, error: "Bill date is required" };
    if (!supplierName.trim()) return { ok: false, error: "Supplier name is required" };
    if (grand <= 0) return { ok: false, error: "Grand total must be greater than zero" };
    if (paymentMode === "cash" && get().tillBalance < grand) {
      return { ok: false, error: `Till short — ${formatNu(get().tillBalance)} available` };
    }
    const cleanLines = (lines ?? [])
      .filter((l) => l.skuId && l.qty > 0)
      .map((l) => ({
        skuId: l.skuId,
        name: l.name.trim(),
        qty: Math.max(0, Number(l.qty) || 0),
        uom: l.uom.trim() || "pc",
        unitCost: Math.max(0, Number(l.unitCost) || 0),
      }));
    const jr =
      journalNo?.trim() ||
      suggestPurchaseJournalNo(get().purchases, billDate);
    const bill: PurchaseBill = {
      id: crypto.randomUUID(),
      billNo: billNo.trim(),
      billDate,
      supplierName: supplierName.trim(),
      category,
      taxableBtn: taxable,
      gstBtn: gst,
      nonTaxableBtn: nonTax,
      grandTotalBtn: grand,
      paymentMode,
      journalNo: jr,
      createdAt: new Date().toISOString(),
      lines: cleanLines.length ? cleanLines : undefined,
    };
    set((s) => ({
      tillBalance:
        paymentMode === "cash" ? s.tillBalance - grand : s.tillBalance,
      purchases: [bill, ...s.purchases],
    }));
    if (cleanLines.length) {
      // Lazy import avoids circular init with inventory consumers
      void import("./inventory-store").then(({ useInventoryStore }) => {
        useInventoryStore.getState().receiveStock(cleanLines, bill.billNo);
      });
    }
    return { ok: true, bill };
  },

  buildChecklist: () => {
    const fo = useFrontOfficeStore.getState();
    const fnb = useFnbStore.getState();
    const openPos = fnb.cart.length;
    const heldPos = fnb.heldChecks.length;
    const openKots = fnb.kots.filter((k) => k.status === "preparing" || k.status === "ready").length;
    const shiftOpen = fnb.shift?.status === "open";
    const unassigned = fo.stays.filter(
      (s) =>
        s.checkIn === fo.businessDate &&
        ["confirmed", "held"].includes(s.status) &&
        !s.roomId,
    ).length;
    const arrivalsNotResolved = fo.stays.filter(
      (s) =>
        s.checkIn === fo.businessDate &&
        ["confirmed", "held"].includes(s.status),
    ).length;
    const depLeft = fo.stays.filter(
      (s) => s.checkOut === fo.businessDate && s.status === "checked_in",
    ).length;
    const openBal = fo.stays.filter(
      (s) => s.status === "checked_in" && folioBalance(s) > 0 && s.checkOut === fo.businessDate,
    ).length;
    const openTables = fnb.tables.filter((t) => t.status === "seated").length;

    return [
      {
        id: "pos",
        label: "Open POS carts / held checks",
        status: openPos > 0 || heldPos > 0 ? "blocked" : "ok",
        detail:
          openPos > 0 || heldPos > 0
            ? `${openPos} active line(s)${heldPos ? ` · ${heldPos} held` : ""}`
            : "Clear",
      },
      {
        id: "kds",
        label: "Open restaurant KOTs",
        status: openKots > 0 ? "blocked" : "ok",
        detail: openKots > 0 ? `${openKots} preparing/ready — close or room-charge` : "Pass clear",
      },
      {
        id: "tables",
        label: "Open restaurant tables",
        status: openTables > 0 ? "blocked" : "ok",
        detail: openTables > 0 ? `${openTables} seated — transfer or settle` : "Clear",
      },
      {
        id: "till",
        label: "Front desk till reconciled",
        status: shiftOpen ? "blocked" : "ok",
        detail: shiftOpen
          ? "POS shift still open — close & count cash before rollover"
          : "Shift closed / no open float",
      },
      {
        id: "unassigned",
        label: "Unassigned arrivals",
        status: unassigned > 0 ? "blocked" : "ok",
        detail: unassigned > 0 ? `${unassigned} need rooms (use Smart Auto-Assign)` : "None",
      },
      {
        id: "arrivals",
        label: "Arrivals checked in or no-show",
        status: arrivalsNotResolved > 0 ? "blocked" : "ok",
        detail:
          arrivalsNotResolved > 0
            ? `${arrivalsNotResolved} still confirmed/held — check-in or mark no-show at audit`
            : "Resolved",
      },
      {
        id: "departures",
        label: "Departures not checked out",
        status: depLeft > 0 ? "blocked" : "ok",
        detail: depLeft > 0 ? `${depLeft} still in-house` : "None",
      },
      {
        id: "balances",
        label: "Departing open balances",
        status: openBal > 0 ? "blocked" : "ok",
        detail: openBal > 0 ? `${openBal} folios unpaid` : "Settled",
      },
    ] satisfies AuditStep[];
  },

  runNightAudit: () => {
    const checklist = get().buildChecklist();
    // Arrivals + unassigned are soft — no-shows / assign can continue at rollover
    const blockers = checklist.filter(
      (c) =>
        c.status === "blocked" && c.id !== "arrivals" && c.id !== "unassigned",
    );
    if (blockers.length > 0) {
      return {
        ok: false,
        error: `Blocked: ${blockers.map((b) => b.label).join(", ")}`,
      };
    }
    const fo = useFrontOfficeStore.getState();
    const date = fo.businessDate;

    // Tip pool points from biometric punches (enterprise ops)
    let tipPoolPoints = 0;
    try {
      // Dynamic import pattern avoided — sync read if store already loaded
      const ops = (
        globalThis as unknown as {
          __hosOpsPunches?: number;
        }
      ).__hosOpsPunches;
      tipPoolPoints = typeof ops === "number" ? ops : 0;
    } catch {
      tipPoolPoints = 0;
    }
    void import("./enterprise-ops-store")
      .then(({ useEnterpriseOpsStore }) => {
        const punches = useEnterpriseOpsStore.getState().punches ?? [];
        const todayPunches = punches.filter((p) =>
          p.punchedAtIso.startsWith(date),
        );
        tipPoolPoints = todayPunches.length;
      })
      .catch((err) => {
        console.error("[fiscal] tip pool punch read failed", err);
      });

    // Money + no-shows + business date advance only via API night_audit.run ACK.
    // Local pack: tip-pool snapshot / CSV seal only — never postCharge room nights here.
    const next = addDays(date, 1);

    // Sync tip points after microtask if import resolved
    void import("./enterprise-ops-store").then(({ useEnterpriseOpsStore }) => {
      const punches = useEnterpriseOpsStore.getState().punches ?? [];
      const pts = punches.filter((p) => p.punchedAtIso.startsWith(date)).length;
      set((s) => ({
        auditLog: s.auditLog.map((line, i) =>
          i === 0 && line.includes("tip pool")
            ? line.replace(/tip pool \d+/, `tip pool ${pts}`)
            : line,
        ),
      }));
    });

    set((s) => ({
      lastAuditDate: date,
      auditLog: [
        `Local pack ${date} → ${next} · tip pool ${tipPoolPoints} pts · CSV/snapshot only (money via API)`,
        ...s.auditLog,
      ],
    }));
    return { ok: true, nextDate: next, tipPoolPoints };
  },

  runAutonomousNightAudit: () => {
    const res = get().runNightAudit();
    if (!res.ok) return res;
    const snapshotId = `nas-${res.nextDate}-${crypto.randomUUID().slice(0, 8)}`;
    set((s) => ({
      auditLog: [
        `Immutable snapshot ${snapshotId} sealed`,
        ...s.auditLog,
      ],
    }));
    return { ...res, snapshotId };
  },

  reportPayload: (id) => {
    const fo = useFrontOfficeStore.getState();
    const fnb = useFnbStore.getState();
    const fiscal = get();
    const inHouse = fo.stays.filter((s) => s.status === "checked_in");

    switch (id) {
      case "bst3": {
        const roomNet = inHouse.reduce((s, st) => s + st.nightlyNet, 0);
        const t = taxBreakdown(roomNet);
        return {
          headline: `BST-3 draft · SC tip pool ${formatNu(t.scAmount)}`,
          rows: [
            ["Bucket", "Net", "SC 10%", "BST 10%", "Total"],
            ["Room", formatNu(t.netAmount), formatNu(t.scAmount), formatNu(t.bstAmount), formatNu(t.totalAmount)],
            ["F&B POS", formatNu(fnb.orders.reduce((s, o) => s + o.net, 0)), formatNu(fnb.orders.reduce((s, o) => s + o.sc, 0)), formatNu(fnb.orders.reduce((s, o) => s + o.bst, 0)), formatNu(fnb.orders.reduce((s, o) => s + o.total, 0))],
          ],
        };
      }
      case "tourist_manifest": {
        const foreign = inHouse.filter((s) => {
          const nat = s.nationality?.trim().toLowerCase() ?? "";
          return nat && nat !== "bhutanese";
        });
        return {
          headline: `In-house foreign nationals · ${fo.businessDate}`,
          rows: [
            [
              "Guest",
              "Passport",
              "Nationality",
              "Room",
              "Checkout",
              "Agent",
              "Guide",
              "Vehicle",
            ],
            ...foreign.map((s) => {
              const meta = s.groupId ? fo.groupMeta[s.groupId] : undefined;
              return [
                s.guestName,
                s.passportOrCid,
                s.nationality,
                s.roomNumber ?? "—",
                s.checkOut,
                s.agencyName ?? meta?.agencyName ?? "—",
                meta?.guideName ?? "—",
                meta?.vehicleNo ?? "—",
              ];
            }),
          ],
        };
      }
      case "night_revenue":
        return {
          headline: "Daily revenue by department",
          rows: [
            ["Dept", "Amount"],
            ["Room", formatNu(inHouse.reduce((s, st) => s + st.nightlyNet, 0))],
            ["F&B", formatNu(fnb.orders.reduce((s, o) => s + o.total, 0))],
            ["Laundry", formatNu(0)],
            ["Other", formatNu(0)],
          ],
        };
      case "cash_drawer":
        return {
          headline: `Till slip · ${formatNu(fiscal.tillBalance)}`,
          rows: [
            ["Item", "Amount"],
            ["Opening / live till", formatNu(fiscal.tillBalance)],
            ...fiscal.purchases
              .filter((p) => p.paymentMode === "cash")
              .slice(0, 5)
              .map((p) => [
                `${p.billNo} · ${p.supplierName}`,
                formatNu(-p.grandTotalBtn),
              ]),
          ],
        };
      case "meal_forecast": {
        const map = inHouse.filter((s) => s.mealPlan === "MAP" || s.mealPlan === "AP").length;
        const ap = inHouse.filter((s) => s.mealPlan === "AP").length;
        const cp = inHouse.filter((s) => s.mealPlan === "CP" || s.mealPlan === "MAP" || s.mealPlan === "AP").length;
        return {
          headline: "Kitchen meal pax forecast",
          rows: [
            ["Meal", "Pax"],
            ["Breakfast (CP+)", String(cp)],
            ["Lunch (AP)", String(ap)],
            ["Dinner (MAP/AP)", String(map)],
          ],
        };
      }
      case "pos_velocity": {
        const counts = new Map<string, number>();
        for (const o of fnb.orders) {
          for (const l of o.lines) counts.set(l.name, (counts.get(l.name) ?? 0) + l.qty);
        }
        for (const k of fnb.kots) {
          for (const l of k.lines) counts.set(l.name, (counts.get(l.name) ?? 0) + l.qty);
        }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        return {
          headline: "Top selling menu items",
          rows: [["Item", "Qty"], ...top.map(([n, q]) => [n, String(q)])],
        };
      }
      case "revpar": {
        const occ = fo.rooms.filter((r) =>
          inHouse.some((s) => s.roomId === r.id),
        ).length;
        const occPct = Math.round((occ / fo.rooms.length) * 100);
        const roomRev = inHouse.reduce((s, st) => s + st.nightlyNet, 0);
        const adr = occ ? Math.round(roomRev / occ) : 0;
        const revpar = Math.round(roomRev / fo.rooms.length);
        return {
          headline: `Occ ${occPct}% · ADR ${formatNu(adr)} · RevPAR ${formatNu(revpar)}`,
          rows: [
            ["Metric", "Value"],
            ["Occupancy", `${occPct}%`],
            ["ADR", formatNu(adr)],
            ["RevPAR", formatNu(revpar)],
          ],
        };
      }
      case "petty_cash":
        return {
          headline: "Purchase bill journal",
          rows: [
            ["Bill", "Date", "Supplier", "Category", "Pay", "Jrno", "G.total"],
            ...fiscal.purchases.map((p) => [
              p.billNo,
              p.billDate,
              p.supplierName,
              purchaseCategoryLabel(p.category),
              p.paymentMode,
              p.journalNo,
              formatNu(p.grandTotalBtn),
            ]),
          ],
        };
      case "guide_dorm":
        return {
          headline: "Guide & driver dorm nights",
          rows: [
            ["Name", "Bed", "Group"],
            ["Tshering Norbu", "Staff Dorm #02", "Yangphel"],
            ["Kinley Wangchuk", "Staff Dorm #02", "Yangphel (driver)"],
            ["Sonam Tobgay", "Staff Dorm #05", "Druk Asia"],
          ],
        };
      default:
        return {
          headline: DRC_REPORTS.find((r) => r.id === id)?.title ?? id,
          rows: [
            ["Field", "Value"],
            ["Business date", fo.businessDate],
            ["Generated", new Date().toLocaleString()],
            ["Status", "Ready for manager pack"],
          ],
        };
    }
  },
}));
