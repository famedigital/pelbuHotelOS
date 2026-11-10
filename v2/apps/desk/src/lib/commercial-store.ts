import { create } from "zustand";
import { setPropertyTaxPolicy } from "./property-tax-policy";

export type MealPlan = "EP" | "CP" | "MAP" | "AP";
export type Season = "peak" | "lean";
/** @deprecated Prefer scOn / gstOn + inclusive display toggles */
export type EntryMode = "net" | "sc_incl" | "all_in";
export type RateCardKind = "public" | "personal" | "agent" | "mou" | "custom";

const SC_RATE = 0.1;
const GST_RATE = 0.1;

export type RoomTypeCode =
  | "deluxe_queen"
  | "deluxe_king"
  | "deluxe_twin"
  | "suite"
  | (string & {});

/** @deprecated Use RateCard.id — kept for gradual call-site migration */
export type RatePlanCode = string;

export type RateCard = {
  id: string;
  code: string;
  name: string;
  kind: RateCardKind;
  active: boolean;
};

/** Occupancy / add-on band on a rate card cell */
export type OccupancyBand = "double" | "single" | "extra" | "child";

export type RateCell = {
  rateCardId: string;
  typeCode: RoomTypeCode;
  season: Season;
  mealPlan: MealPlan;
  /** @deprecated Prefer doubleNet — kept for Fast Book / Partner pickup */
  netAmount: number;
  /** 2 adults (standard sell) */
  doubleNet: number;
  /** 1 adult */
  singleNet: number;
  /** Extra bed / mattress per night */
  extraNet: number;
  /** Child 6–11 sharing (meal + bed share); 0–5 stay free by policy */
  childNet: number;
};

export function cellBandNet(cell: RateCell, band: OccupancyBand): number {
  if (band === "single") return cell.singleNet;
  if (band === "extra") return cell.extraNet;
  if (band === "child") return cell.childNet;
  return cell.doubleNet ?? cell.netAmount;
}

function round50(n: number): number {
  return Math.round(n / 50) * 50;
}

function occupancyFromDouble(doubleNet: number, mealAdd: number): Pick<
  RateCell,
  "netAmount" | "doubleNet" | "singleNet" | "extraNet" | "childNet"
> {
  const double = Math.max(0, Math.round(doubleNet));
  return {
    netAmount: double,
    doubleNet: double,
    singleNet: round50(double * 0.85),
    extraNet: round50(double * 0.3),
    childNet: round50(mealAdd * 0.5 + double * 0.12),
  };
}

export type Agent = {
  id: string;
  name: string;
  code: string;
  contact: string;
  creditLimit: number;
  usedCredit: number;
  termsDays: number;
  rateCardId: string;
  aging: { current: number; d30: number; d60: number; d90: number };
  active: boolean;
  creditHold?: boolean;
};

type CommercialState = {
  /** Legacy single mode — kept in sync with SC/GST toggles for older call sites */
  entryMode: EntryMode;
  /** Property charges 10% service charge */
  scOn: boolean;
  /** Desk types base net; when true the edit field includes SC */
  scInclusive: boolean;
  /** When false, GST is not charged (new license / exempt) */
  gstOn: boolean;
  /** Show / enter price including GST (only meaningful when gstOn) */
  gstInclusive: boolean;
  season: Season;
  mealPlan: MealPlan;
  selectedRateCardId: string;
  rateCards: RateCard[];
  cells: RateCell[];
  agents: Agent[];
  setEntryMode: (m: EntryMode) => void;
  setScOn: (v: boolean) => void;
  setScInclusive: (v: boolean) => void;
  setGstOn: (v: boolean) => void;
  setGstInclusive: (v: boolean) => void;
  setSeason: (s: Season) => void;
  setMealPlan: (m: MealPlan) => void;
  selectRateCard: (id: string) => void;
  setNetRate: (rateCardId: string, typeCode: RoomTypeCode, net: number) => void;
  setOccupancyRate: (
    rateCardId: string,
    typeCode: RoomTypeCode,
    band: OccupancyBand,
    net: number,
  ) => void;
  createRateCard: (input: {
    code: string;
    name: string;
    kind: RateCardKind;
    cloneFromId?: string;
  }) => { ok: true; id: string } | { ok: false; error: string };
  renameRateCard: (id: string, name: string) => { ok: true } | { ok: false; error: string };
  archiveRateCard: (id: string) => { ok: true } | { ok: false; error: string };
  assignAgentRateCard: (
    agentId: string,
    rateCardId: string,
  ) => { ok: true } | { ok: false; error: string };
  quoteDisplay: (net: number) => {
    net: number;
    sc: number;
    bst: number;
    total: number;
    input: number;
  };
  /** Amount shown in the rate field given current SC/GST toggles */
  shownFromNet: (net: number) => number;
  /** Convert typed field value back to stored base net */
  netFromShown: (shown: number) => number;
  bookAllotment: (
    agentId: string,
    amount: number,
  ) => { ok: true } | { ok: false; error: string };
  recordPayment: (
    agentId: string,
    amount: number,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  setCreditHold: (
    agentId: string,
    hold: boolean,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  allocateWireBatch: (
    agentIds: string[],
    amount: number,
  ) => { ok: true; applied: number } | { ok: false; error: string };
};

/** Rate-sheet categories — docs/rate-public.html (Queen/King/Twin + Suite). */
export const TYPES: { code: RoomTypeCode; name: string }[] = [
  { code: "deluxe_queen", name: "Deluxe Queen" },
  { code: "deluxe_king", name: "Deluxe King" },
  { code: "deluxe_twin", name: "Deluxe Twin" },
  { code: "suite", name: "Pelbu Suite" },
];

const MEAL_ADD: Record<MealPlan, number> = { EP: 0, CP: 450, MAP: 1100, AP: 1600 };
const SEASON_MULT: Record<Season, number> = { peak: 1.25, lean: 0.85 };

const CARD_SEEDS: { id: string; code: string; name: string; kind: RateCardKind; disc: number }[] = [
  { id: "rc-public", code: "PUBLIC", name: "Public / walk-in", kind: "public", disc: 1 },
  { id: "rc-personal", code: "PERSONAL", name: "Personal / negotiated FIT", kind: "personal", disc: 0.95 },
  { id: "rc-agt-common", code: "AGT-COMMON", name: "B2B common MoU", kind: "agent", disc: 0.85 },
  { id: "rc-agt1", code: "AGT1", name: "Yangphel special", kind: "mou", disc: 0.8 },
  { id: "rc-agt6", code: "AGT6", name: "Etho Metho special", kind: "mou", disc: 0.82 },
  { id: "rc-corp", code: "CORP", name: "Corporate", kind: "custom", disc: 0.92 },
  { id: "rc-long", code: "LONG", name: "Long Stay", kind: "custom", disc: 0.8 },
  { id: "rc-gov", code: "GOV", name: "Government", kind: "custom", disc: 0.88 },
];

/** Legacy alias — active cards as { code, name } for older UI. */
export const PLANS: { code: string; name: string }[] = CARD_SEEDS.map((c) => ({
  code: c.code,
  name: c.name,
}));

function seedRateCards(): RateCard[] {
  return CARD_SEEDS.map(({ id, code, name, kind }) => ({
    id,
    code,
    name,
    kind,
    active: true,
  }));
}

function seedCellsForCards(cards: RateCard[]): RateCell[] {
  /* EP room net excl. SC — public peak double EPAI / 1.1 (docs/rate-public.html). */
  const base: Record<string, number> = {
    deluxe_queen: 5900,
    deluxe_king: 5900,
    deluxe_twin: 5900,
    suite: 14350,
  };
  const discById = Object.fromEntries(CARD_SEEDS.map((c) => [c.id, c.disc]));
  const out: RateCell[] = [];
  for (const season of ["peak", "lean"] as const) {
    for (const card of cards) {
      const disc = discById[card.id] ?? 0.9;
      for (const t of TYPES) {
        for (const meal of ["EP", "CP", "MAP", "AP"] as const) {
          const double = round50(
            base[t.code] * disc * SEASON_MULT[season] + MEAL_ADD[meal],
          );
          out.push({
            rateCardId: card.id,
            typeCode: t.code,
            season,
            mealPlan: meal,
            ...occupancyFromDouble(double, MEAL_ADD[meal]),
          });
        }
      }
    }
  }
  return out;
}

function cloneCells(
  source: RateCell[],
  fromId: string,
  toId: string,
): RateCell[] {
  return source
    .filter((c) => c.rateCardId === fromId)
    .map((c) => ({ ...c, rateCardId: toId }));
}

function slugifyCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

function syncEntryMode(
  scOn: boolean,
  scInclusive: boolean,
  gstInclusive: boolean,
  gstOn: boolean,
): EntryMode {
  if (scOn && scInclusive && gstInclusive && gstOn) return "all_in";
  if (scOn && scInclusive) return "sc_incl";
  return "net";
}

/** Pure tax split from base net (SC 10%; GST on net+SC when enabled). */
export function rateTaxSplit(
  net: number,
  opts: { scOn?: boolean; gstOn?: boolean } = {},
) {
  const scOn = opts.scOn !== false;
  const gstOn = opts.gstOn !== false;
  const base = Math.max(0, Math.round(net));
  const sc = scOn ? Math.round(base * SC_RATE) : 0;
  const gst = gstOn ? Math.round((base + sc) * GST_RATE) : 0;
  return {
    net: base,
    sc,
    gst,
    bst: gst,
    total: base + sc + gst,
  };
}

export function shownPriceFromNet(
  net: number,
  opts: {
    scOn: boolean;
    scInclusive: boolean;
    gstInclusive: boolean;
    gstOn: boolean;
  },
): number {
  const t = rateTaxSplit(net, { scOn: opts.scOn, gstOn: opts.gstOn });
  let n = t.net;
  if (opts.scOn && opts.scInclusive) n += t.sc;
  if (opts.gstOn && opts.gstInclusive) n += t.gst;
  return n;
}

export function netFromShownPrice(
  shown: number,
  opts: {
    scOn: boolean;
    scInclusive: boolean;
    gstInclusive: boolean;
    gstOn: boolean;
  },
): number {
  const raw = Math.max(0, Number(shown) || 0);
  const { scOn, scInclusive, gstInclusive, gstOn } = opts;
  const inclSc = scOn && scInclusive;
  const inclGst = gstOn && gstInclusive;
  if (inclSc && inclGst) return Math.round(raw / (1 + SC_RATE) / (1 + GST_RATE));
  if (inclSc) return Math.round(raw / (1 + SC_RATE));
  if (inclGst) {
    // GST on (net+SC) but SC not in shown → shown = net + 0.1*(net+0) if SC off,
    // or net + 0.1*(net+0.1net) if SC on but excluded from field
    if (scOn) return Math.round(raw / (1 + GST_RATE * (1 + SC_RATE)));
    return Math.round(raw / (1 + GST_RATE));
  }
  return Math.round(raw);
}

export const useCommercialStore = create<CommercialState>((set, get) => {
  const rateCards = seedRateCards();
  return {
    entryMode: "net",
    scOn: true,
    scInclusive: false,
    /** Default OFF — hotel not GST-eligible (new license) */
    gstOn: false,
    gstInclusive: false,
    season: "peak",
    mealPlan: "MAP",
    selectedRateCardId: "rc-public",
    rateCards,
    cells: seedCellsForCards(rateCards),
    agents: [
      {
        id: "ag-yap",
        name: "Yangphel Adventure Travel",
        code: "YAP",
        contact: "+975-2-323293 · ops@yangphel.bt",
        creditLimit: 500000,
        usedCredit: 168000,
        termsDays: 30,
        rateCardId: "rc-agt1",
        aging: { current: 88000, d30: 45000, d60: 25000, d90: 10000 },
        active: true,
      },
      {
        id: "ag-da",
        name: "Druk Asia Tours & Treks",
        code: "DA",
        contact: "+975-2-334411 · ops@drukasia.com",
        creditLimit: 350000,
        usedCredit: 125000,
        termsDays: 30,
        rateCardId: "rc-agt-common",
        aging: { current: 70000, d30: 35000, d60: 20000, d90: 0 },
        active: true,
      },
      {
        id: "ag-bp",
        name: "Blue Poppy Tours",
        code: "BP",
        contact: "+975-2-321100 · bookings@bluepoppy.bt",
        creditLimit: 200000,
        usedCredit: 42000,
        termsDays: 15,
        rateCardId: "rc-agt-common",
        aging: { current: 42000, d30: 0, d60: 0, d90: 0 },
        active: true,
      },
      {
        id: "ag-etho",
        name: "Etho Metho Tours",
        code: "EM",
        contact: "+975-2-323456 · ethometho@druknet.bt",
        creditLimit: 250000,
        usedCredit: 0,
        termsDays: 30,
        rateCardId: "rc-agt6",
        aging: { current: 0, d30: 0, d60: 0, d90: 0 },
        active: true,
      },
    ],

    setEntryMode: (m) => {
      if (m === "net") {
        set({
          entryMode: "net",
          scInclusive: false,
          gstInclusive: false,
        });
        return;
      }
      if (m === "sc_incl") {
        setPropertyTaxPolicy({ scOn: true });
        set({
          entryMode: "sc_incl",
          scOn: true,
          scInclusive: true,
          gstInclusive: false,
        });
        return;
      }
      setPropertyTaxPolicy({ scOn: true, gstOn: true });
      set({
        entryMode: "all_in",
        scOn: true,
        scInclusive: true,
        gstOn: true,
        gstInclusive: true,
      });
    },
    setScOn: (v) =>
      set((s) => {
        const scOn = v;
        const scInclusive = v ? s.scInclusive : false;
        setPropertyTaxPolicy({ scOn });
        return {
          scOn,
          scInclusive,
          entryMode: syncEntryMode(scOn, scInclusive, s.gstInclusive, s.gstOn),
        };
      }),
    setScInclusive: (v) =>
      set((s) => {
        const scInclusive = s.scOn ? v : false;
        return {
          scInclusive,
          entryMode: syncEntryMode(s.scOn, scInclusive, s.gstInclusive, s.gstOn),
        };
      }),
    setGstOn: (v) =>
      set((s) => {
        const gstOn = v;
        const gstInclusive = v ? s.gstInclusive : false;
        setPropertyTaxPolicy({ gstOn });
        return {
          gstOn,
          gstInclusive,
          entryMode: syncEntryMode(s.scOn, s.scInclusive, gstInclusive, gstOn),
        };
      }),
    setGstInclusive: (v) =>
      set((s) => {
        const gstInclusive = s.gstOn ? v : false;
        return {
          gstInclusive,
          entryMode: syncEntryMode(s.scOn, s.scInclusive, gstInclusive, s.gstOn),
        };
      }),
    setSeason: (s) => set({ season: s }),
    setMealPlan: (m) => set({ mealPlan: m }),
    selectRateCard: (id) => set({ selectedRateCardId: id }),

    setNetRate: (rateCardId, typeCode, net) => {
      get().setOccupancyRate(rateCardId, typeCode, "double", net);
    },

    setOccupancyRate: (rateCardId, typeCode, band, net) => {
      const { season, mealPlan } = get();
      const value = Math.max(0, Math.round(net));
      set((s) => ({
        cells: s.cells.map((c) => {
          if (
            c.rateCardId !== rateCardId ||
            c.typeCode !== typeCode ||
            c.season !== season ||
            c.mealPlan !== mealPlan
          ) {
            return c;
          }
          const base: RateCell = {
            ...c,
            doubleNet: c.doubleNet ?? c.netAmount,
            singleNet: c.singleNet ?? round50((c.doubleNet ?? c.netAmount) * 0.85),
            extraNet: c.extraNet ?? round50((c.doubleNet ?? c.netAmount) * 0.3),
            childNet: c.childNet ?? round50(MEAL_ADD[c.mealPlan] * 0.5),
          };
          if (band === "double") {
            return { ...base, doubleNet: value, netAmount: value };
          }
          if (band === "single") return { ...base, singleNet: value };
          if (band === "extra") return { ...base, extraNet: value };
          return { ...base, childNet: value };
        }),
      }));
    },

    createRateCard: ({ code, name, kind, cloneFromId }) => {
      const slug = slugifyCode(code || name);
      if (!slug) return { ok: false, error: "Code is required" };
      if (!name.trim()) return { ok: false, error: "Name is required" };
      const existing = get().rateCards.find(
        (c) => c.code === slug || c.code.toLowerCase() === slug.toLowerCase(),
      );
      if (existing) return { ok: false, error: `Code ${slug} already exists` };
      const id = `rc-${crypto.randomUUID().slice(0, 8)}`;
      const fromId =
        cloneFromId && get().rateCards.some((c) => c.id === cloneFromId)
          ? cloneFromId
          : get().rateCards.find((c) => c.code === "PUBLIC")?.id ?? get().rateCards[0]?.id;
      if (!fromId) return { ok: false, error: "No source card to clone" };
      set((s) => ({
        rateCards: [
          ...s.rateCards,
          { id, code: slug, name: name.trim(), kind, active: true },
        ],
        cells: [...s.cells, ...cloneCells(s.cells, fromId, id)],
        selectedRateCardId: id,
      }));
      return { ok: true, id };
    },

    renameRateCard: (id, name) => {
      if (!name.trim()) return { ok: false, error: "Name is required" };
      const card = get().rateCards.find((c) => c.id === id);
      if (!card) return { ok: false, error: "Rate card not found" };
      set((s) => ({
        rateCards: s.rateCards.map((c) =>
          c.id === id ? { ...c, name: name.trim() } : c,
        ),
      }));
      return { ok: true };
    },

    archiveRateCard: (id) => {
      const active = get().rateCards.filter((c) => c.active);
      if (active.length <= 1) {
        return { ok: false, error: "Keep at least one active rate card" };
      }
      const card = get().rateCards.find((c) => c.id === id);
      if (!card) return { ok: false, error: "Rate card not found" };
      if (card.kind === "public") {
        return { ok: false, error: "Public rate card cannot be archived" };
      }
      const fallback =
        get().rateCards.find((c) => c.active && c.id !== id && c.code === "PUBLIC")?.id ??
        get().rateCards.find((c) => c.active && c.id !== id)?.id;
      if (!fallback) return { ok: false, error: "No fallback card" };
      set((s) => ({
        rateCards: s.rateCards.map((c) =>
          c.id === id ? { ...c, active: false } : c,
        ),
        agents: s.agents.map((a) =>
          a.rateCardId === id ? { ...a, rateCardId: fallback } : a,
        ),
        selectedRateCardId:
          s.selectedRateCardId === id ? fallback : s.selectedRateCardId,
      }));
      return { ok: true };
    },

    assignAgentRateCard: (agentId, rateCardId) => {
      const card = get().rateCards.find((c) => c.id === rateCardId && c.active);
      if (!card) return { ok: false, error: "Rate card not found" };
      const agent = get().agents.find((a) => a.id === agentId);
      if (!agent) return { ok: false, error: "Agent not found" };
      set((s) => ({
        agents: s.agents.map((a) =>
          a.id === agentId ? { ...a, rateCardId } : a,
        ),
      }));
      return { ok: true };
    },

    quoteDisplay: (net) => {
      const { scOn, gstOn } = get();
      const t = rateTaxSplit(net, { scOn, gstOn });
      return {
        net: t.net,
        sc: t.sc,
        bst: t.gst,
        total: t.total,
        input: net,
      };
    },
    shownFromNet: (net) => {
      const { scOn, scInclusive, gstInclusive, gstOn } = get();
      return shownPriceFromNet(net, { scOn, scInclusive, gstInclusive, gstOn });
    },
    netFromShown: (shown) => {
      const { scOn, scInclusive, gstInclusive, gstOn } = get();
      return netFromShownPrice(shown, { scOn, scInclusive, gstInclusive, gstOn });
    },

    bookAllotment: (agentId, amount) => {
      const agent = get().agents.find((a) => a.id === agentId);
      if (!agent) return { ok: false, error: "Agent not found" };
      if (agent.usedCredit + amount > agent.creditLimit) {
        return {
          ok: false,
          error: `Credit limit Nu. ${agent.creditLimit.toLocaleString()} exceeded`,
        };
      }
      set((s) => ({
        agents: s.agents.map((a) =>
          a.id !== agentId
            ? a
            : {
                ...a,
                usedCredit: a.usedCredit + amount,
                aging: { ...a.aging, current: a.aging.current + amount },
              },
        ),
      }));
      return { ok: true };
    },

    recordPayment: async (agentId, amount) => {
      const agent = get().agents.find((a) => a.id === agentId);
      if (!agent) return { ok: false, error: "Agent not found" };
      if (amount <= 0) return { ok: false, error: "Amount must be positive" };
      const UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!UUID_RE.test(agentId)) {
        return {
          ok: false,
          error: "Agent not synced to API — AR payment blocked",
        };
      }
      const { newIdempotencyKey, runCommand } = await import("./api");
      const remote = await runCommand("agents.recordPayment", {
        agentId,
        amount,
        method: "bank",
        idempotencyKey: newIdempotencyKey(),
      });
      if (!remote.ok) return { ok: false, error: remote.error };
      set((s) => ({
        agents: s.agents.map((a) => {
          if (a.id !== agentId) return a;
          let left = amount;
          const aging = { ...a.aging };
          for (const key of ["d90", "d60", "d30", "current"] as const) {
            const take = Math.min(aging[key], left);
            aging[key] -= take;
            left -= take;
          }
          return {
            ...a,
            usedCredit: Math.max(0, a.usedCredit - amount),
            aging,
          };
        }),
      }));
      return { ok: true };
    },

    setCreditHold: async (agentId, hold) => {
      const agent = get().agents.find((a) => a.id === agentId);
      if (!agent) return { ok: false, error: "Agent not found" };
      const UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!UUID_RE.test(agentId)) {
        return {
          ok: false,
          error: "Agent not synced to API — credit hold blocked",
        };
      }
      const { newIdempotencyKey, runCommand } = await import("./api");
      const remote = await runCommand("agents.creditHold", {
        agentId,
        hold,
        idempotencyKey: newIdempotencyKey(),
      });
      if (!remote.ok) return { ok: false, error: remote.error };
      set((s) => ({
        agents: s.agents.map((a) =>
          a.id === agentId ? { ...a, creditHold: hold } : a,
        ),
      }));
      return { ok: true };
    },

    allocateWireBatch: (agentIds, amount) => {
      if (amount <= 0) return { ok: false, error: "Wire amount must be positive" };
      if (agentIds.length === 0) return { ok: false, error: "Select at least one operator" };
      const unique = [...new Set(agentIds)];
      let applied = 0;
      set((s) => {
        let left = amount;
        const agents = s.agents.map((a) => ({ ...a, aging: { ...a.aging } }));
        for (const id of unique) {
          if (left <= 0) break;
          const idx = agents.findIndex((a) => a.id === id);
          if (idx === -1) continue;
          const a = agents[idx]!;
          const slice = Math.min(left, a.usedCredit);
          if (slice <= 0) continue;
          let payLeft = slice;
          for (const key of ["d90", "d60", "d30", "current"] as const) {
            const take = Math.min(agents[idx]!.aging[key], payLeft);
            agents[idx]!.aging[key] -= take;
            payLeft -= take;
          }
          agents[idx] = {
            ...a,
            usedCredit: Math.max(0, a.usedCredit - slice),
            aging: agents[idx]!.aging,
          };
          left -= slice;
          applied += slice;
        }
        return { agents };
      });
      if (applied <= 0) {
        return { ok: false, error: "No AR balance on selected operators" };
      }
      return { ok: true, applied };
    },
  };
});

export function rateCardById(
  cards: RateCard[],
  id: string | undefined | null,
): RateCard | undefined {
  return cards.find((c) => c.id === id);
}

export function cellsForCard(
  cells: RateCell[],
  rateCardId: string,
  season: Season,
  mealPlan: MealPlan,
): RateCell[] {
  return cells.filter(
    (c) =>
      c.rateCardId === rateCardId &&
      c.season === season &&
      c.mealPlan === mealPlan,
  );
}

export function findRateCell(
  cells: RateCell[],
  rateCardId: string,
  typeCode: string,
  season: Season,
  mealPlan: MealPlan,
): RateCell | undefined {
  return cells.find(
    (c) =>
      c.rateCardId === rateCardId &&
      c.typeCode === typeCode &&
      c.season === season &&
      c.mealPlan === mealPlan,
  );
}

/** Occupancy band from adult count — extra/child stay additive at desk. */
export function bandFromAdults(adults: number): OccupancyBand {
  return adults === 1 ? "single" : "double";
}

/**
 * Base net from a rate card cell (meal already baked into seeded cells).
 * Prefer this over stacking meal surcharges on top of card nets.
 */
export function quoteFromCard(input: {
  cells: RateCell[];
  rateCardId: string;
  /** FO + commercial room type codes (same string set in desk seed) */
  typeCode: string;
  season: Season;
  mealPlan: MealPlan;
  band?: OccupancyBand;
  adults?: number;
  fallbackNet?: number;
}): number {
  const band =
    input.band ??
    (input.adults != null ? bandFromAdults(input.adults) : "double");
  const cell = findRateCell(
    input.cells,
    input.rateCardId,
    input.typeCode,
    input.season,
    input.mealPlan,
  );
  if (!cell) return Math.max(0, Math.round(input.fallbackNet ?? 0));
  return cellBandNet(cell, band);
}

/**
 * Resolve which rate card to use for desk / partner / stay quote pickup.
 * Priority: explicit → agent id → agency name match → walk-in PERSONAL → PUBLIC.
 */
export function resolveRateCardId(input: {
  agents: Agent[];
  rateCards: RateCard[];
  agentId?: string | null;
  agencyName?: string | null;
  explicitCardId?: string | null;
  profile?: "walk_in" | "corporate" | "agent";
}): string {
  const active = input.rateCards.filter((c) => c.active);
  const publicId =
    active.find((c) => c.code === "PUBLIC")?.id ?? active[0]?.id ?? "";
  if (input.explicitCardId) {
    const hit = active.find((c) => c.id === input.explicitCardId);
    if (hit) return hit.id;
  }
  if (input.agentId) {
    const ag = input.agents.find((a) => a.id === input.agentId && a.active);
    if (ag?.rateCardId) {
      const card = active.find((c) => c.id === ag.rateCardId);
      if (card) return card.id;
    }
  }
  if (input.agencyName?.trim()) {
    const name = input.agencyName.trim().toLowerCase();
    const ag = input.agents.find(
      (a) =>
        a.active &&
        (a.name.toLowerCase() === name ||
          a.code.toLowerCase() === name ||
          a.name.toLowerCase().includes(name)),
    );
    if (ag?.rateCardId) {
      const card = active.find((c) => c.id === ag.rateCardId);
      if (card) return card.id;
    }
  }
  if (input.profile === "corporate") {
    return (
      active.find((c) => c.code === "CORP")?.id ??
      active.find((c) => c.code === "PUBLIC")?.id ??
      publicId
    );
  }
  if (input.profile === "walk_in" || !input.profile) {
    return (
      active.find((c) => c.code === "PERSONAL")?.id ??
      active.find((c) => c.code === "PUBLIC")?.id ??
      publicId
    );
  }
  return publicId;
}
