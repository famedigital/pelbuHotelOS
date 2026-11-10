/**
 * Field companions (guide / driver) — cache + actions wired to FO, F&B, till.
 * No shadow money; advances and KOTs go through existing authority paths.
 */
import { create } from "zustand";
import { newIdempotencyKey, runCommand } from "./api";
import { useEnterpriseOpsStore } from "./enterprise-ops-store";
import { useFnbStore } from "./fnb-store";
import {
  groupMembers,
  useFrontOfficeStore,
  type Stay,
} from "./front-office-store";

/** Fallback when group meta has no driver — also seeded into extras fleet. */
export const DRIVER_SESSION = {
  name: "Tashi",
  phone: "+975-17662041",
  vehicleNo: "BP-1-A2041",
  dormBed: "Bed B-02",
  whatsappE164: "97517662041",
} as const;

export type DriverProfile = {
  name: string;
  phone: string;
  vehicleNo: string;
  dormBed: string;
  whatsappE164: string;
  groupId: string | null;
  groupCode: string | null;
};

export type FuelAdvanceRow = {
  id: string;
  amountBtn: number;
  at: string;
  persistence: "postgres" | "local_demo";
  driverName: string;
  groupId: string | null;
};

export type RunLegStatus = "pending" | "en_route" | "arrived" | "done";

export type RunLeg = {
  id: string;
  groupId: string;
  kind: "pickup" | "drop";
  stayId: string;
  guestName: string;
  roomNumber: string | null;
  status: RunLegStatus;
};

/** Server-priced box breakfast SKU (kitchen KDS). */
export const BOX_BREAKFAST_MENU_ID = "10000000-0000-4000-8000-3540980cbeaf";

export type PartnerVoucherUpload = {
  id: string;
  fileName: string;
  amountBtn: number;
  groupId: string | null;
  masterStayId: string | null;
  linkedAt: string;
  status: "queued" | "linked" | "failed";
  error?: string;
};

export type AllotmentBlock = {
  id: string;
  typeCode: string;
  from: string;
  to: string;
  nights: number;
  netRateBtn: number;
  mouCode: string;
  createdAt: string;
};

type EcosystemState = {
  guideGroupId: string;
  boxBreakfastQty: number;
  vouchers: PartnerVoucherUpload[];
  allotments: AllotmentBlock[];
  fuelAdvances: FuelAdvanceRow[];
  runLegs: RunLeg[];
  setGuideGroupId: (id: string) => void;
  setBoxBreakfastQty: (n: number) => void;
  syncBreakfastQtyFromRoster: () => number;
  dietBadge: (stay: Stay) => string | null;
  driverForGroup: (groupId: string) => DriverProfile;
  activeDriver: () => DriverProfile;
  healGuideRoster: () => { restored: number };
  ensureRunLegs: (businessDate: string) => void;
  setLegStatus: (legId: string, status: RunLegStatus) => void;
  orderBoxBreakfast: () => Promise<
    { ok: true; kotIds: string[]; qty: number } | { ok: false; error: string }
  >;
  checkInArrival: (
    stayId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  requestFuelAdvance: (amountBtn: number) => Promise<
    | { ok: true; advanceId: string; persistence: "postgres" | "local_demo" }
    | { ok: false; error: string }
  >;
  placeAllotmentBlock: (input: {
    typeCode: string;
    from: string;
    to: string;
    netRateBtn: number;
    mouCode: string;
  }) => { ok: true; block: AllotmentBlock } | { ok: false; error: string };
  allotmentCovers: (typeCode: string, checkIn: string) => AllotmentBlock | null;
  /** True when check-in is within 48h and no MoU allotment covers the type. */
  isAllotmentBlocked: (typeCode: string, checkIn: string) => {
    blocked: boolean;
    reason: string | null;
  };
  uploadVoucherPdf: (input: {
    fileName: string;
    amountBtn: number;
    groupId?: string | null;
  }) => Promise<
    { ok: true; voucher: PartnerVoucherUpload } | { ok: false; error: string }
  >;
};

function phoneToWa(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

function driverFromMeta(
  groupId: string,
  meta: {
    code?: string;
    driverName?: string;
    vehicleNo?: string;
    driverDormBed?: string;
    agencyContact?: string;
  } | undefined,
): DriverProfile {
  if (!meta?.driverName) {
    return { ...DRIVER_SESSION, groupId, groupCode: meta?.code ?? null };
  }
  const phoneMatch = meta.agencyContact?.match(/\+975[\d\s-]+/);
  const phone = phoneMatch?.[0]?.trim() || DRIVER_SESSION.phone;
  return {
    name: meta.driverName,
    phone,
    vehicleNo: meta.vehicleNo || DRIVER_SESSION.vehicleNo,
    dormBed: meta.driverDormBed || DRIVER_SESSION.dormBed,
    whatsappE164: phoneToWa(phone) || DRIVER_SESSION.whatsappE164,
    groupId,
    groupCode: meta.code ?? null,
  };
}

function hoursUntil(dateYmd: string): number {
  const target = new Date(`${dateYmd}T14:00:00`);
  return (target.getTime() - Date.now()) / 3_600_000;
}

function ymdAdd(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Seed MoU allotments so partner Book within 48h is not blocked in demo. */
function seedMouAllotments(): AllotmentBlock[] {
  const today = new Date().toISOString().slice(0, 10);
  const types = ["DLX-K", "STD-T", "STE-K", "DLX-T"];
  return types.map((typeCode, i) => ({
    id: `allot-seed-${typeCode}`,
    typeCode,
    from: today,
    to: ymdAdd(today, 21),
    nights: 21,
    netRateBtn: 4500 + i * 400,
    mouCode: "MOU-YAP-DEMO",
    createdAt: new Date().toISOString(),
  }));
}

export const useEcosystemStore = create<EcosystemState>((set, get) => ({
  guideGroupId: "grp-001",
  boxBreakfastQty: 14,
  vouchers: [],
  allotments: seedMouAllotments(),
  fuelAdvances: [],
  runLegs: [],

  setGuideGroupId: (id) => set({ guideGroupId: id }),
  setBoxBreakfastQty: (n) =>
    set({ boxBreakfastQty: Math.min(80, Math.max(1, Math.round(n))) }),

  syncBreakfastQtyFromRoster: () => {
    const fo = useFrontOfficeStore.getState();
    const live = groupMembers(fo.stays, get().guideGroupId).filter(
      (s) => !["cancelled", "no_show", "checked_out"].includes(s.status),
    );
    const qty = Math.max(1, live.length);
    set({ boxBreakfastQty: qty });
    return qty;
  },

  dietBadge: (stay) => {
    const flags = stay.stayFlags ?? [];
    if (flags.includes("diet_veg_strict") || flags.includes("diet_jain"))
      return "Veg";
    if (flags.includes("diet_no_pork")) return "No pork";
    if (flags.includes("diet_gluten_free")) return "GF";
    if (stay.notes?.toLowerCase().includes("veg")) return "Veg";
    if (stay.notes?.toLowerCase().includes("pork")) return "No pork";
    return null;
  },

  driverForGroup: (groupId) => {
    const meta = useFrontOfficeStore.getState().groupMeta[groupId];
    return driverFromMeta(groupId, meta);
  },

  activeDriver: () => get().driverForGroup(get().guideGroupId),

  healGuideRoster: () => {
    const fo = useFrontOfficeStore.getState();
    const gid = get().guideGroupId;
    const live = groupMembers(fo.stays, gid);
    if (live.length > 0) return { restored: 0 };
    const meta = fo.groupMeta[gid];
    const agencyToken = (meta?.agencyName ?? "").split(" ")[0]?.toLowerCase() ?? "";
    const candidates = fo.stays.filter((s) => {
      if (["cancelled", "no_show"].includes(s.status)) return false;
      if (s.groupId === gid) return true;
      if (meta && s.groupName === meta.name) return true;
      if (
        agencyToken &&
        s.source === "agent" &&
        (s.agencyName?.toLowerCase().includes(agencyToken) ?? false) &&
        ["checked_in", "confirmed", "held"].includes(s.status)
      ) {
        return true;
      }
      return false;
    });
    if (candidates.length === 0) return { restored: 0 };
    useFrontOfficeStore.setState((s) => ({
      stays: s.stays.map((st) =>
        candidates.some((o) => o.id === st.id)
          ? {
              ...st,
              groupId: gid,
              groupName: meta?.name ?? st.groupName,
            }
          : st,
      ),
      liveRevision: s.liveRevision + 1,
    }));
    get().syncBreakfastQtyFromRoster();
    return { restored: candidates.length };
  },

  ensureRunLegs: (businessDate) => {
    const fo = useFrontOfficeStore.getState();
    const existing = new Set(get().runLegs.map((l) => `${l.kind}:${l.stayId}`));
    const next: RunLeg[] = [...get().runLegs];
    for (const g of Object.values(fo.groupMeta)) {
      const members = groupMembers(fo.stays, g.id);
      for (const s of members) {
        if (
          s.checkIn === businessDate &&
          ["confirmed", "held", "checked_in"].includes(s.status)
        ) {
          const key = `pickup:${s.id}`;
          if (!existing.has(key)) {
            next.push({
              id: crypto.randomUUID(),
              groupId: g.id,
              kind: "pickup",
              stayId: s.id,
              guestName: s.guestName,
              roomNumber: s.roomNumber,
              status: s.status === "checked_in" ? "arrived" : "pending",
            });
            existing.add(key);
          }
        }
        if (s.checkOut === businessDate && s.status === "checked_in") {
          const key = `drop:${s.id}`;
          if (!existing.has(key)) {
            next.push({
              id: crypto.randomUUID(),
              groupId: g.id,
              kind: "drop",
              stayId: s.id,
              guestName: s.guestName,
              roomNumber: s.roomNumber,
              status: "pending",
            });
            existing.add(key);
          }
        }
      }
    }
    set({ runLegs: next });
  },

  setLegStatus: (legId, status) =>
    set((s) => ({
      runLegs: s.runLegs.map((l) => (l.id === legId ? { ...l, status } : l)),
    })),

  orderBoxBreakfast: async () => {
    const qty = get().boxBreakfastQty;
    const fnb = useFnbStore.getState();
    if (fnb.shift?.status !== "open") {
      const opened = await fnb.openShift(0);
      if (!opened.ok) return { ok: false, error: opened.error };
    }
    await fnb.hydrateCatalog();
    const menuHit = fnb.menu.find(
      (m) =>
        m.id === BOX_BREAKFAST_MENU_ID ||
        m.name.toLowerCase().includes("breakfast"),
    );
    if (!menuHit) {
      return {
        ok: false,
        error: "Breakfast SKU missing — hydrate POS catalog from API",
      };
    }
    fnb.selectTable("BOX-BF");
    fnb.clearCart();
    for (let i = 0; i < qty; i++) fnb.addToCart(menuHit.id);
    const noteKey = fnb.cart.find((c) => c.menuItemId === menuHit.id)?.key;
    if (noteKey) {
      fnb.setLineNote(
        noteKey,
        `Guide packed · ${qty} · group ${get().guideGroupId}`,
      );
    }
    const fired = await fnb.fireKot();
    if (!fired.ok) return { ok: false, error: fired.error };
    return { ok: true, kotIds: fired.kotIds, qty };
  },

  checkInArrival: async (stayId) => {
    const fo = useFrontOfficeStore.getState();
    const stay = fo.stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Guest not on roster" };
    if (stay.status === "checked_in") {
      return { ok: false, error: "Already checked in" };
    }
    if (!["confirmed", "held"].includes(stay.status)) {
      return { ok: false, error: `Cannot check in · status ${stay.status}` };
    }
    if (!stay.roomId) {
      return {
        ok: false,
        error: "No room assigned — ask desk to assign first",
      };
    }
    return fo.checkIn(stayId, "Guide companion");
  },

  requestFuelAdvance: async (amountBtn) => {
    if (amountBtn <= 0) return { ok: false, error: "Amount must be positive" };
    const driver = get().activeDriver();
    const res = await useEnterpriseOpsStore.getState().issueAdvanceRemote({
      amountBtn,
      issuedToName: driver.name,
      purpose: "fuel_market",
    });
    if (!res.ok) return res;
    const row: FuelAdvanceRow = {
      id: res.advance.id,
      amountBtn,
      at: new Date().toISOString(),
      persistence: res.persistence,
      driverName: driver.name,
      groupId: driver.groupId,
    };
    set((s) => ({ fuelAdvances: [row, ...s.fuelAdvances].slice(0, 40) }));
    return {
      ok: true,
      advanceId: res.advance.id,
      persistence: res.persistence,
    };
  },

  placeAllotmentBlock: ({ typeCode, from, to, netRateBtn, mouCode }) => {
    if (!typeCode || !from || !to) {
      return { ok: false, error: "Type and dates required" };
    }
    if (to <= from) return { ok: false, error: "Check-out must be after check-in" };
    const nights = Math.max(
      1,
      Math.round(
        (new Date(`${to}T00:00:00`).getTime() -
          new Date(`${from}T00:00:00`).getTime()) /
          86_400_000,
      ),
    );
    const block: AllotmentBlock = {
      id: crypto.randomUUID(),
      typeCode,
      from,
      to,
      nights,
      netRateBtn,
      mouCode,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ allotments: [block, ...s.allotments] }));
    return { ok: true, block };
  },

  allotmentCovers: (typeCode, checkIn) => {
    return (
      get().allotments.find(
        (a) => a.typeCode === typeCode && a.from <= checkIn && checkIn < a.to,
      ) ?? null
    );
  },

  isAllotmentBlocked: (typeCode, checkIn) => {
    const hrs = hoursUntil(checkIn);
    if (hrs > 48) return { blocked: false, reason: null };
    const cover = get().allotmentCovers(typeCode, checkIn);
    if (cover) return { blocked: false, reason: null };
    return {
      blocked: true,
      reason: `Within 48h of arrival — place a MoU allotment block for ${typeCode} first`,
    };
  },

  uploadVoucherPdf: async ({ fileName, amountBtn, groupId }) => {
    if (!fileName.trim()) return { ok: false, error: "PDF file name required" };
    if (amountBtn <= 0) return { ok: false, error: "Voucher amount required" };
    const fo = useFrontOfficeStore.getState();
    const gid = groupId ?? get().guideGroupId;
    const members = groupMembers(fo.stays, gid);
    const master =
      members.find((s) => s.status === "checked_in") ?? members[0] ?? null;
    const id = crypto.randomUUID();
    const base: PartnerVoucherUpload = {
      id,
      fileName: fileName.trim(),
      amountBtn,
      groupId: gid,
      masterStayId: master?.id ?? null,
      linkedAt: new Date().toISOString(),
      status: "queued",
    };
    set((s) => ({ vouchers: [base, ...s.vouchers] }));

    if (!master) {
      const failed = {
        ...base,
        status: "failed" as const,
        error: "No group stay to attach master folio",
      };
      set((s) => ({
        vouchers: s.vouchers.map((v) => (v.id === id ? failed : v)),
      }));
      return { ok: false, error: failed.error };
    }

    const folioId = master.apiAgencyFolioId ?? master.apiFolioId;
    if (folioId) {
      const pay = await runCommand("finance.postPayment", {
        folioId,
        amount: amountBtn,
        method: "bank",
        idempotencyKey: newIdempotencyKey(),
      });
      if (!pay.ok) {
        const failed = { ...base, status: "failed" as const, error: pay.error };
        set((s) => ({
          vouchers: s.vouchers.map((v) => (v.id === id ? failed : v)),
        }));
        return { ok: false, error: pay.error };
      }
    } else {
      /* Seed / pre-hydrate: append master payment line on stay cache — not fiscal INV. */
      const lineId = crypto.randomUUID();
      useFrontOfficeStore.setState((s) => ({
        stays: s.stays.map((st) =>
          st.id !== master.id
            ? st
            : {
                ...st,
                folioLines: [
                  ...st.folioLines,
                  {
                    id: lineId,
                    postedAt: new Date().toISOString(),
                    kind: "payment" as const,
                    description: `Agent voucher PDF · ${fileName.trim()}`,
                    netAmount: -amountBtn,
                    scAmount: 0,
                    bstAmount: 0,
                    totalAmount: -amountBtn,
                    voided: false,
                    stream: "master" as const,
                  },
                ],
                audit: [
                  {
                    id: crypto.randomUUID(),
                    at: new Date().toISOString(),
                    actor: "Partner portal",
                    message: `Voucher PDF linked · Nu ${amountBtn.toLocaleString()} · ${fileName.trim()}`,
                  },
                  ...st.audit,
                ],
              },
        ),
        liveRevision: s.liveRevision + 1,
      }));
    }

    const linked = { ...base, status: "linked" as const };
    set((s) => ({
      vouchers: s.vouchers.map((v) => (v.id === id ? linked : v)),
    }));
    return { ok: true, voucher: linked };
  },
}));
