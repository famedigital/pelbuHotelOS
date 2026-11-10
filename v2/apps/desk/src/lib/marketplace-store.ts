/**
 * Innora-wide guide/fleet marketplace — presence, job requests, opaque affiliate commissions.
 * Guest folio never shows commission; accrual is hotel AP split (guide + Innora).
 */
import { create } from "zustand";
import { useExtrasStore } from "./extras-store";

export type PresenceStatus = "free" | "busy" | "at_property";

export type MarketplaceProperty = {
  id: string;
  name: string;
  area: string;
};

export type GuidePresence = {
  guideId: string;
  status: PresenceStatus;
  atPropertyId: string | null;
  updatedAt: string;
};

export type VehiclePresence = {
  vehicleId: string;
  status: PresenceStatus;
  atPropertyId: string | null;
  updatedAt: string;
};

export type FleetRequestKind = "guide" | "vehicle";
export type FleetRequestStatus = "open" | "accepted" | "cancelled" | "fulfilled" | "declined";

export type FleetRequest = {
  id: string;
  kind: FleetRequestKind;
  status: FleetRequestStatus;
  postedBy: "hotel" | "agent";
  posterLabel: string;
  propertyId: string;
  propertyName: string;
  windowFrom: string;
  windowTo: string;
  pax: number;
  languages: string;
  area: string;
  notesPublic: string;
  createdAt: string;
  assigneeGuideId: string | null;
  assigneeVehicleId: string | null;
  acceptedAt: string | null;
};

export type AffiliateReferralStatus =
  | "pending"
  | "accrued"
  | "payable"
  | "paid"
  | "void";

export type AffiliateReferral = {
  id: string;
  referrerKind: "guide" | "driver";
  referrerId: string;
  referrerName: string;
  propertyId: string;
  propertyName: string;
  guestDisplay: string;
  nights: number;
  roomNetBtn: number;
  commissionRatePct: number;
  guideSplitPct: number;
  innoraSplitPct: number;
  guideAmountBtn: number;
  innoraAmountBtn: number;
  status: AffiliateReferralStatus;
  createdAt: string;
  accruedAt: string | null;
  idempotencyKey: string;
};

export type MarketplaceCommissionSettings = {
  /** Platform default total % of room net */
  platformDefaultPct: number;
  platformMinPct: number;
  platformMaxPct: number;
  guideSharePct: number;
  innoraSharePct: number;
  /** Per-property total % override (clamped) */
  propertyPct: Record<string, number>;
};

type MarketplaceState = {
  properties: MarketplaceProperty[];
  guidePresence: Record<string, GuidePresence>;
  vehiclePresence: Record<string, VehiclePresence>;
  requests: FleetRequest[];
  referrals: AffiliateReferral[];
  settings: MarketplaceCommissionSettings;
  setGuidePresence: (
    guideId: string,
    status: PresenceStatus,
    atPropertyId?: string | null,
  ) => void;
  setVehiclePresence: (
    vehicleId: string,
    status: PresenceStatus,
    atPropertyId?: string | null,
  ) => void;
  postRequest: (input: {
    kind: FleetRequestKind;
    postedBy: "hotel" | "agent";
    posterLabel: string;
    propertyId: string;
    windowFrom: string;
    windowTo: string;
    pax: number;
    languages: string;
    area: string;
    notesPublic: string;
  }) => { ok: true; request: FleetRequest } | { ok: false; error: string };
  acceptRequest: (
    requestId: string,
    assignee: { guideId?: string; vehicleId?: string },
  ) => { ok: true } | { ok: false; error: string };
  declineRequest: (requestId: string) => { ok: true } | { ok: false; error: string };
  cancelRequest: (requestId: string) => { ok: true } | { ok: false; error: string };
  setPropertyCommissionPct: (
    propertyId: string,
    pct: number,
  ) => { ok: true } | { ok: false; error: string };
  effectiveCommissionPct: (propertyId: string) => number;
  createRoomReferral: (input: {
    referrerKind: "guide" | "driver";
    referrerId: string;
    referrerName: string;
    propertyId: string;
    guestDisplay: string;
    nights: number;
    roomNetBtn: number;
    idempotencyKey: string;
  }) => { ok: true; referral: AffiliateReferral } | { ok: false; error: string };
  accrueReferral: (
    referralId: string,
  ) => { ok: true; referral: AffiliateReferral } | { ok: false; error: string };
  openRequests: (kind?: FleetRequestKind) => FleetRequest[];
  freeGuides: () => { guideId: string; name: string; languages: string; presence: GuidePresence }[];
  freeVehicles: () => {
    vehicleId: string;
    plate: string;
    driver: string;
    seats: number;
    presence: VehiclePresence;
  }[];
};

const PROPERTIES: MarketplaceProperty[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Demo Hotel · Thimphu",
    area: "Thimphu",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Paro Valley Suites",
    area: "Paro",
  },
  {
    id: "prop-punakha",
    name: "Punakha Riverside Lodge",
    area: "Punakha",
  },
];

function ymdAdd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seedPresence(): {
  guidePresence: Record<string, GuidePresence>;
  vehiclePresence: Record<string, VehiclePresence>;
} {
  const now = new Date().toISOString();
  const guides = useExtrasStore.getState().guides;
  const vehicles = useExtrasStore.getState().vehicles;
  const guidePresence: Record<string, GuidePresence> = {};
  guides.forEach((g, i) => {
    guidePresence[g.id] = {
      guideId: g.id,
      status: i === 2 ? "free" : i === 0 ? "at_property" : "busy",
      atPropertyId: i === 0 ? PROPERTIES[0]!.id : null,
      updatedAt: now,
    };
  });
  const vehiclePresence: Record<string, VehiclePresence> = {};
  vehicles.forEach((v, i) => {
    vehiclePresence[v.id] = {
      vehicleId: v.id,
      status: i === 2 ? "free" : i === 0 ? "at_property" : "free",
      atPropertyId: i === 0 ? PROPERTIES[1]!.id : null,
      updatedAt: now,
    };
  });
  return { guidePresence, vehiclePresence };
}

function seedRequests(): FleetRequest[] {
  const now = new Date().toISOString();
  return [
    {
      id: "freq-1",
      kind: "guide",
      status: "open",
      postedBy: "hotel",
      posterLabel: "Demo Hotel FO",
      propertyId: PROPERTIES[0]!.id,
      propertyName: PROPERTIES[0]!.name,
      windowFrom: ymdAdd(1),
      windowTo: ymdAdd(4),
      pax: 8,
      languages: "English · French",
      area: "Thimphu",
      notesPublic: "Cultural circuit · French-speaking preferred",
      createdAt: now,
      assigneeGuideId: null,
      assigneeVehicleId: null,
      acceptedAt: null,
    },
    {
      id: "freq-2",
      kind: "vehicle",
      status: "open",
      postedBy: "agent",
      posterLabel: "Yangphel Adventure Travel",
      propertyId: PROPERTIES[1]!.id,
      propertyName: PROPERTIES[1]!.name,
      windowFrom: ymdAdd(2),
      windowTo: ymdAdd(5),
      pax: 14,
      languages: "—",
      area: "Paro",
      notesPublic: "Airport → hotel → Tiger’s Nest base (no guest names until accept)",
      createdAt: now,
      assigneeGuideId: null,
      assigneeVehicleId: null,
      acceptedAt: null,
    },
  ];
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => {
  const seeded = seedPresence();
  return {
    properties: PROPERTIES,
    guidePresence: seeded.guidePresence,
    vehiclePresence: seeded.vehiclePresence,
    requests: seedRequests(),
    referrals: [],
    settings: {
      platformDefaultPct: 10,
      platformMinPct: 5,
      platformMaxPct: 15,
      guideSharePct: 70,
      innoraSharePct: 30,
      propertyPct: {},
    },

    setGuidePresence: (guideId, status, atPropertyId = null) => {
      set((s) => ({
        guidePresence: {
          ...s.guidePresence,
          [guideId]: {
            guideId,
            status,
            atPropertyId: status === "at_property" ? atPropertyId : null,
            updatedAt: new Date().toISOString(),
          },
        },
      }));
    },

    setVehiclePresence: (vehicleId, status, atPropertyId = null) => {
      set((s) => ({
        vehiclePresence: {
          ...s.vehiclePresence,
          [vehicleId]: {
            vehicleId,
            status,
            atPropertyId: status === "at_property" ? atPropertyId : null,
            updatedAt: new Date().toISOString(),
          },
        },
      }));
    },

    postRequest: (input) => {
      if (input.pax < 1) return { ok: false, error: "Pax must be at least 1" };
      if (input.windowTo < input.windowFrom) {
        return { ok: false, error: "End date must be on/after start" };
      }
      const prop = get().properties.find((p) => p.id === input.propertyId);
      if (!prop) return { ok: false, error: "Unknown property" };
      const request: FleetRequest = {
        id: crypto.randomUUID(),
        kind: input.kind,
        status: "open",
        postedBy: input.postedBy,
        posterLabel: input.posterLabel.trim() || "Poster",
        propertyId: prop.id,
        propertyName: prop.name,
        windowFrom: input.windowFrom,
        windowTo: input.windowTo,
        pax: Math.round(input.pax),
        languages: input.languages.trim() || "—",
        area: input.area.trim() || prop.area,
        notesPublic: input.notesPublic.trim().slice(0, 280),
        createdAt: new Date().toISOString(),
        assigneeGuideId: null,
        assigneeVehicleId: null,
        acceptedAt: null,
      };
      set((s) => ({ requests: [request, ...s.requests] }));
      return { ok: true, request };
    },

    acceptRequest: (requestId, assignee) => {
      const req = get().requests.find((r) => r.id === requestId);
      if (!req) return { ok: false, error: "Request not found" };
      if (req.status !== "open") return { ok: false, error: "Request is not open" };
      if (req.kind === "guide" && !assignee.guideId) {
        return { ok: false, error: "Guide required" };
      }
      if (req.kind === "vehicle" && !assignee.vehicleId) {
        return { ok: false, error: "Vehicle required" };
      }
      set((s) => ({
        requests: s.requests.map((r) =>
          r.id !== requestId
            ? r
            : {
                ...r,
                status: "accepted",
                assigneeGuideId: assignee.guideId ?? null,
                assigneeVehicleId: assignee.vehicleId ?? null,
                acceptedAt: new Date().toISOString(),
              },
        ),
      }));
      if (assignee.guideId) {
        get().setGuidePresence(assignee.guideId, "busy");
      }
      if (assignee.vehicleId) {
        get().setVehiclePresence(assignee.vehicleId, "busy");
      }
      return { ok: true };
    },

    declineRequest: (requestId) => {
      const req = get().requests.find((r) => r.id === requestId);
      if (!req || req.status !== "open") {
        return { ok: false, error: "Open request required" };
      }
      set((s) => ({
        requests: s.requests.map((r) =>
          r.id === requestId ? { ...r, status: "declined" } : r,
        ),
      }));
      return { ok: true };
    },

    cancelRequest: (requestId) => {
      const req = get().requests.find((r) => r.id === requestId);
      if (!req || !["open", "accepted"].includes(req.status)) {
        return { ok: false, error: "Cannot cancel" };
      }
      set((s) => ({
        requests: s.requests.map((r) =>
          r.id === requestId ? { ...r, status: "cancelled" } : r,
        ),
      }));
      return { ok: true };
    },

    setPropertyCommissionPct: (propertyId, pct) => {
      const { platformMinPct, platformMaxPct } = get().settings;
      if (pct < platformMinPct || pct > platformMaxPct) {
        return {
          ok: false,
          error: `Commission must be between ${platformMinPct}% and ${platformMaxPct}%`,
        };
      }
      set((s) => ({
        settings: {
          ...s.settings,
          propertyPct: { ...s.settings.propertyPct, [propertyId]: pct },
        },
      }));
      return { ok: true };
    },

    effectiveCommissionPct: (propertyId) => {
      const s = get().settings;
      return s.propertyPct[propertyId] ?? s.platformDefaultPct;
    },

    createRoomReferral: (input) => {
      if (input.nights < 1 || input.roomNetBtn <= 0) {
        return { ok: false, error: "Nights and room net required" };
      }
      const dup = get().referrals.find(
        (r) => r.idempotencyKey === input.idempotencyKey && r.status !== "void",
      );
      if (dup) return { ok: true, referral: dup };
      const prop = get().properties.find((p) => p.id === input.propertyId);
      if (!prop) return { ok: false, error: "Unknown property" };
      const rate = get().effectiveCommissionPct(input.propertyId);
      const { guideSharePct, innoraSharePct } = get().settings;
      const pool = Math.round((input.roomNetBtn * input.nights * rate) / 100);
      const guideAmountBtn = Math.round((pool * guideSharePct) / 100);
      const innoraAmountBtn = pool - guideAmountBtn;
      const referral: AffiliateReferral = {
        id: crypto.randomUUID(),
        referrerKind: input.referrerKind,
        referrerId: input.referrerId,
        referrerName: input.referrerName,
        propertyId: prop.id,
        propertyName: prop.name,
        guestDisplay: input.guestDisplay.trim() || "Guest",
        nights: input.nights,
        roomNetBtn: input.roomNetBtn,
        commissionRatePct: rate,
        guideSplitPct: guideSharePct,
        innoraSplitPct: innoraSharePct,
        guideAmountBtn,
        innoraAmountBtn,
        status: "pending",
        createdAt: new Date().toISOString(),
        accruedAt: null,
        idempotencyKey: input.idempotencyKey,
      };
      set((s) => ({ referrals: [referral, ...s.referrals] }));
      return { ok: true, referral };
    },

    accrueReferral: (referralId) => {
      const ref = get().referrals.find((r) => r.id === referralId);
      if (!ref) return { ok: false, error: "Referral not found" };
      if (ref.status === "accrued" || ref.status === "payable" || ref.status === "paid") {
        return { ok: true, referral: ref };
      }
      if (ref.status === "void") return { ok: false, error: "Referral voided" };
      const next: AffiliateReferral = {
        ...ref,
        status: "payable",
        accruedAt: new Date().toISOString(),
      };
      set((s) => ({
        referrals: s.referrals.map((r) => (r.id === referralId ? next : r)),
      }));
      return { ok: true, referral: next };
    },

    openRequests: (kind) =>
      get().requests.filter(
        (r) => r.status === "open" && (!kind || r.kind === kind),
      ),

    freeGuides: () => {
      const guides = useExtrasStore.getState().guides;
      const { guidePresence } = get();
      return guides
        .filter((g) => {
          const p = guidePresence[g.id];
          return p && (p.status === "free" || p.status === "at_property");
        })
        .map((g) => ({
          guideId: g.id,
          name: g.name,
          languages: g.languages,
          presence: guidePresence[g.id]!,
        }));
    },

    freeVehicles: () => {
      const vehicles = useExtrasStore.getState().vehicles;
      const { vehiclePresence } = get();
      return vehicles
        .filter((v) => {
          const p = vehiclePresence[v.id];
          return p && (p.status === "free" || p.status === "at_property");
        })
        .map((v) => ({
          vehicleId: v.id,
          plate: v.plate,
          driver: v.driver,
          seats: v.seats,
          presence: vehiclePresence[v.id]!,
        }));
    },
  };
});

export function presenceLabel(
  status: PresenceStatus,
  atName?: string | null,
): string {
  if (status === "free") return "Free";
  if (status === "busy") return "Busy";
  return atName ? `At ${atName}` : "At hotel";
}
