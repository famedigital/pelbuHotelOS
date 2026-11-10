import { create } from "zustand";
import {
  canIssueTaxInvoice,
  formatNu,
  folioTotals,
  useFrontOfficeStore,
  folioBalance,
} from "./front-office-store";
import { useFiscalStore } from "./fiscal-store";
import { useFnbStore } from "./fnb-store";
import {
  allocateFolioNo,
  allocateInvoiceNo,
  allocatePsbnNo,
  peekNextFolioNo,
  peekNextInvoiceNo,
  peekNextPsbnNo,
} from "./doc-numbers";
export type FiscalDoc = {
  id: string;
  kind: "PSBN" | "INV";
  docNo: string;
  party: string;
  partyType: "guest" | "agent";
  amount: number;
  status: "issued" | "void" | "paid";
  at: string;
  /** Lead guest / group when billed to agent city ledger. */
  guestName?: string;
  /** Desk confirmation / booking ref for partner reconciliation. */
  stayRef?: string;
  /** Stay id when issued from StayHub. */
  stayId?: string;
};

export type TillShift = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  expected: number;
  counted: number | null;
  variance: number | null;
  cashier: string;
};

export type ChannelConn = {
  id: string;
  name: string;
  status: "connected" | "degraded" | "offline";
  lastPush: string;
  roomsMapped: number;
};

export type LoyaltyMember = {
  id: string;
  name: string;
  tier: "druk_gold" | "tashi_silver" | "norbu";
  points: number;
  nights: number;
  phone: string;
};

export type GuideReg = {
  id: string;
  name: string;
  tcr: string;
  phone: string;
  languages: string;
  verified: boolean;
  initials: string;
  activeTours: string[];
  mealVoucherActive: boolean;
  guideBed: string | null;
};

export type VehicleFuelLog = {
  id: string;
  at: string;
  litres: number;
  amountNu: number;
  station: string;
};

export type VehicleReg = {
  id: string;
  plate: string;
  type: "coaster" | "hiace" | "suv";
  seats: number;
  driver: string;
  dormBed: string;
  rstaExpiry: string;
  insuranceExpiry: string;
  fuelLogs: VehicleFuelLog[];
};

export type EventBooking = {
  id: string;
  hall: "druk" | "valley";
  title: string;
  date: string;
  pax: number;
  package: string;
  netAmount: number;
  status: "tentative" | "confirmed" | "invoiced";
};

export type ServiceJob = {
  id: string;
  kind: "airport" | "hotspring" | "hike" | "bike";
  guest: string;
  room: string | null;
  when: string;
  detail: string;
  status: "booked" | "dispatched" | "done";
  netAmount: number;
};

export type Campaign = {
  id: string;
  name: string;
  code: string;
  discountPct: number;
  active: boolean;
  starts: string;
  ends: string;
};

type ExtrasState = {
  fiscalDocs: FiscalDoc[];
  tillShifts: TillShift[];
  bankDeposits: { id: string; amount: number; ref: string; matchedShiftId: string | null; at: string }[];
  channelConns: ChannelConn[];
  stopSell: boolean;
  minStay: number;
  lastForcePush: string | null;
  lastChannelPushStatus: "idle" | "queued" | "accepted" | "failed";
  lastChannelPushError: string | null;
  loyalty: LoyaltyMember[];
  guides: GuideReg[];
  vehicles: VehicleReg[];
  events: EventBooking[];
  services: ServiceJob[];
  cms: {
    heroTitle: string;
    heroSub: string;
    story: string;
    restaurantHours: string;
    menuNote: string;
  };
  campaigns: Campaign[];
  waTemplate: string;
  emailTemplate: string;
  website: {
    domain: string;
    seoTitle: string;
    seoDesc: string;
    bookingEngine: boolean;
    sslOk: boolean;
  };
  aiLog: { id: string; q: string; a: string; at: string }[];
  issueFiscal: (input: {
    kind: "PSBN" | "INV";
    party: string;
    partyType: "guest" | "agent";
    amount: number;
    guestName?: string;
    stayRef?: string;
    stayId?: string;
  }) => FiscalDoc;
  /**
   * Desk-explicit tax invoice for a stay. Complementary / no-bill blocked.
   * Uses PSBN for agent city ledger, INV for walk-in / direct guest.
   */
  issueStayTaxInvoice: (stayId: string) =>
    | {
        ok: true;
        doc: FiscalDoc;
      }
    | { ok: false; error: string };
  markFiscalPaid: (id: string) => { ok: true } | { ok: false; error: string };
  peekGaplessDocNo: (kind: "PSBN" | "INV" | "FN") => string;
  closeTillShift: (counted: number) => TillShift;
  matchDeposit: (amount: number, ref: string, shiftId: string) => void;
  forceChannelPush: () => Promise<
    { ok: true; bookingId: string } | { ok: false; error: string }
  >;
  setStopSell: (v: boolean) => void;
  setMinStay: (n: number) => void;
  upsertGuide: (input: {
    id?: string;
    name: string;
    tcr: string;
    phone: string;
    languages: string;
  }) => GuideReg;
  issueVoucher: (memberId: string, points: number) => { ok: true; code: string } | { ok: false; error: string };
  enrolLoyalty: (name: string, phone: string) => LoyaltyMember;
  bookEvent: (input: Omit<EventBooking, "id" | "status">) => EventBooking;
  invoiceEvent: (id: string) => { ok: true } | { ok: false; error: string };
  bookService: (input: Omit<ServiceJob, "id" | "status">) => ServiceJob;
  advanceService: (id: string) => void;
  updateCms: (patch: Partial<ExtrasState["cms"]>) => void;
  toggleCampaign: (id: string) => void;
  addCampaign: (c: Omit<Campaign, "id">) => void;
  updateTemplates: (wa: string, email: string) => void;
  updateWebsite: (patch: Partial<ExtrasState["website"]>) => void;
  askAi: (q: string) => string;
  ownerPulse: () => {
    occPct: number;
    adr: number;
    revpar: number;
    gross: number;
    tillFlags: string[];
    voidFlags: string[];
  };
};

export function peekGaplessDocNoExternal(kind: "PSBN" | "INV" | "FN"): string {
  if (kind === "PSBN") return peekNextPsbnNo();
  if (kind === "FN") return peekNextFolioNo();
  return peekNextInvoiceNo();
}

export function nextFolioNo(): string {
  return allocateFolioNo();
}

export const useExtrasStore = create<ExtrasState>((set, get) => ({
  fiscalDocs: [
    {
      id: "fd-1",
      kind: "PSBN",
      docNo: "DHPSBN01041",
      party: "Jean-Pierre Dubois",
      partyType: "guest",
      amount: 28500,
      status: "issued",
      at: new Date().toISOString(),
      guestName: "Jean-Pierre Dubois",
      stayRef: "PS-2026-1401",
    },
    {
      id: "fd-yap-1",
      kind: "INV",
      docNo: "DHINV00879",
      party: "Yangphel Adventure Travel",
      partyType: "agent",
      amount: 168000,
      status: "issued",
      at: new Date(Date.now() - 12 * 86400000).toISOString(),
      guestName: "Yangphel Autumn Cultural · group",
      stayRef: "GRP-YAP-104",
    },
    {
      id: "fd-yap-2",
      kind: "INV",
      docNo: "DHINV00862",
      party: "Yangphel Adventure Travel",
      partyType: "agent",
      amount: 92400,
      status: "paid",
      at: new Date(Date.now() - 28 * 86400000).toISOString(),
      guestName: "Sophie Laurent party",
      stayRef: "PS-2026-1188",
    },
    {
      id: "fd-yap-3",
      kind: "INV",
      docNo: "DHINV00841",
      party: "Yangphel Adventure Travel",
      partyType: "agent",
      amount: 45600,
      status: "issued",
      at: new Date(Date.now() - 45 * 86400000).toISOString(),
      guestName: "Marcus Weber · FIT",
      stayRef: "PS-2026-1092",
    },
    {
      id: "fd-yap-4",
      kind: "PSBN",
      docNo: "DHPSBN00998",
      party: "Yangphel Adventure Travel",
      partyType: "agent",
      amount: 18600,
      status: "paid",
      at: new Date(Date.now() - 5 * 86400000).toISOString(),
      guestName: "Henri Martin",
      stayRef: "PS-2026-1320",
    },
    {
      id: "fd-yap-5",
      kind: "INV",
      docNo: "DHINV00810",
      party: "Yangphel Adventure Travel",
      partyType: "agent",
      amount: 71200,
      status: "issued",
      at: new Date(Date.now() - 62 * 86400000).toISOString(),
      guestName: "Autumn trek · 4 rooms",
      stayRef: "GRP-YAP-091",
    },
    {
      id: "fd-yap-6",
      kind: "INV",
      docNo: "DHINV00788",
      party: "Yangphel Adventure Travel",
      partyType: "agent",
      amount: 33800,
      status: "void",
      at: new Date(Date.now() - 70 * 86400000).toISOString(),
      guestName: "Cancelled hold · Dubois",
      stayRef: "PS-2026-1011",
    },
    {
      id: "fd-da-1",
      kind: "INV",
      docNo: "DHINV00885",
      party: "Druk Asia Tours & Treks",
      partyType: "agent",
      amount: 125000,
      status: "issued",
      at: new Date(Date.now() - 8 * 86400000).toISOString(),
      guestName: "Druk Asia Heritage Circuit",
      stayRef: "GRP-DA-44",
    },
    {
      id: "fd-da-2",
      kind: "INV",
      docNo: "DHINV00855",
      party: "Druk Asia Tours & Treks",
      partyType: "agent",
      amount: 54200,
      status: "paid",
      at: new Date(Date.now() - 33 * 86400000).toISOString(),
      guestName: "Tokyo FIT · 2N",
      stayRef: "PS-2026-1204",
    },
    {
      id: "fd-bp-1",
      kind: "INV",
      docNo: "DHINV00890",
      party: "Blue Poppy Tours",
      partyType: "agent",
      amount: 42000,
      status: "issued",
      at: new Date(Date.now() - 3 * 86400000).toISOString(),
      guestName: "Blue Poppy weekend",
      stayRef: "GRP-BP-12",
    },
  ],
  tillShifts: [
    {
      id: "shift-1",
      openedAt: new Date(Date.now() - 8 * 3600_000).toISOString(),
      closedAt: null,
      openingFloat: 10000,
      expected: 48250,
      counted: null,
      variance: null,
      cashier: "Karma Dorji",
    },
  ],
  bankDeposits: [],
  channelConns: [
    { id: "bcom", name: "Booking.com", status: "connected", lastPush: "2m ago", roomsMapped: 24 },
    { id: "agoda", name: "Agoda", status: "connected", lastPush: "2m ago", roomsMapped: 24 },
    { id: "mmt", name: "MakeMyTrip", status: "degraded", lastPush: "48m ago", roomsMapped: 18 },
    { id: "exp", name: "Expedia", status: "connected", lastPush: "5m ago", roomsMapped: 24 },
  ],
  stopSell: false,
  minStay: 1,
  lastForcePush: null,
  lastChannelPushStatus: "idle",
  lastChannelPushError: null,
  loyalty: [
    { id: "ly-1", name: "Dr. Henri Martin", tier: "druk_gold", points: 12400, nights: 18, phone: "+33-6-112233" },
    { id: "ly-2", name: "Rachel Tan", tier: "tashi_silver", points: 4200, nights: 6, phone: "+65-9881-2201" },
    { id: "ly-3", name: "Elena Rossi", tier: "norbu", points: 900, nights: 2, phone: "+39-340-112233" },
  ],
  guides: [
    {
      id: "g1",
      name: "Tshering Norbu",
      tcr: "TCR-8492",
      phone: "+975-17618293",
      languages: "English · French · Dzongkha",
      verified: true,
      initials: "TN",
      activeTours: ["Yangphel Autumn Cultural Explorer", "BTCL Heritage Circuit"],
      mealVoucherActive: true,
      guideBed: "Guide Bed #04",
    },
    {
      id: "g2",
      name: "Sonam Tobgay",
      tcr: "TCR-6120",
      phone: "+975-17119922",
      languages: "English · Japanese · Dzongkha",
      verified: true,
      initials: "ST",
      activeTours: ["Druk Asia Photography Expedition"],
      mealVoucherActive: true,
      guideBed: "Guide Bed #07",
    },
    {
      id: "g3",
      name: "Karma Wangdi",
      tcr: "TCR-2201",
      phone: "+975-17882201",
      languages: "English · German · Dzongkha",
      verified: false,
      initials: "KW",
      activeTours: [],
      mealVoucherActive: false,
      guideBed: null,
    },
  ],
  vehicles: [
    {
      id: "v1",
      plate: "BP-1-A8921",
      type: "coaster",
      seats: 22,
      driver: "Kinley Wangchuk",
      dormBed: "Staff Dorm #02",
      rstaExpiry: "2026-08-14",
      insuranceExpiry: "2026-11-30",
      fuelLogs: [
        { id: "fl1", at: new Date(Date.now() - 86400000).toISOString(), litres: 48, amountNu: 3840, station: "BOC Paro" },
      ],
    },
    {
      id: "v2",
      plate: "BP-2-B3419",
      type: "hiace",
      seats: 12,
      driver: "Pema Dorji",
      dormBed: "Staff Dorm #05",
      rstaExpiry: "2026-04-02",
      insuranceExpiry: "2027-01-15",
      fuelLogs: [
        { id: "fl2", at: new Date(Date.now() - 2 * 86400000).toISOString(), litres: 32, amountNu: 2560, station: "Druk Petroleum" },
      ],
    },
    {
      id: "v3",
      plate: "BP-1-C1102",
      type: "suv",
      seats: 6,
      driver: "Namgay Tshering",
      dormBed: "Driver Dorm #01",
      rstaExpiry: "2025-12-20",
      insuranceExpiry: "2026-06-01",
      fuelLogs: [],
    },
    {
      id: "v4",
      plate: "BP-1-A2041",
      type: "hiace",
      seats: 12,
      driver: "Tashi",
      dormBed: "Bed B-02",
      rstaExpiry: "2027-03-01",
      insuranceExpiry: "2027-06-15",
      fuelLogs: [],
    },
  ],
  events: [
    {
      id: "ev-1",
      hall: "druk",
      title: "RTC Faculty Symposium",
      date: new Date().toISOString().slice(0, 10),
      pax: 40,
      package: "Morning tea + Conference lunch + AV",
      netAmount: 68000,
      status: "confirmed",
    },
  ],
  services: [
    {
      id: "sv-1",
      kind: "airport",
      guest: "Christopher Lee",
      room: "203",
      when: new Date(Date.now() + 3 * 3600_000).toISOString(),
      detail: "PBH arrival KB400 · SUV",
      status: "booked",
      netAmount: 3500,
    },
    {
      id: "sv-2",
      kind: "hotspring",
      guest: "Sophie Laurent",
      room: "103",
      when: new Date(Date.now() + 6 * 3600_000).toISOString(),
      detail: "Hot stone bath · 90 min",
      status: "booked",
      netAmount: 4500,
    },
  ],
  cms: {
    heroTitle: "Himalayan stillness, sovereign hospitality",
    heroSub: "Boutique rooms above the Paro valley",
    story: "A family-run Himalayan house for travellers who want quiet luxury and Bhutanese warmth.",
    restaurantHours: "Breakfast 07:00–10:00 · Dinner 18:30–21:30",
    menuNote: "MAP dinner includes Ema Datshi or vegetarian thali.",
  },
  campaigns: [
    {
      id: "camp-1",
      name: "Paro Tshechu Stay",
      code: "PAROTSHECHU15",
      discountPct: 15,
      active: true,
      starts: "2026-03-20",
      ends: "2026-04-05",
    },
    {
      id: "camp-2",
      name: "Thimphu Tshechu",
      code: "THIMPHU10",
      discountPct: 10,
      active: false,
      starts: "2026-09-25",
      ends: "2026-10-05",
    },
  ],
  waTemplate:
    "Kuzuzangpo {{guest}}! Your stay at {{hotel}} is confirmed {{checkIn}}–{{checkOut}}. Room {{room}}. Safe travels.",
  emailTemplate:
    "Dear {{guest}},\n\nThank you for choosing {{hotel}}. Confirmation {{ref}}.\nCheck-in {{checkIn}} from 14:00.\n\nWarm regards,\nFront Desk",
  website: {
    domain: "book.demo-hotel.bt",
    seoTitle: "Demo Hotel · Paro Boutique Stay",
    seoDesc: "Book direct — valley views, MAP dining, airport transfers.",
    bookingEngine: true,
    sslOk: true,
  },
  aiLog: [],

  peekGaplessDocNo: (kind) => peekGaplessDocNoExternal(kind),

  markFiscalPaid: (id) => {
    const hit = get().fiscalDocs.find((d) => d.id === id);
    if (!hit) return { ok: false, error: "FISCAL_DOC_NOT_FOUND" };
    if (hit.status === "void") return { ok: false, error: "VOID_DOC_CANNOT_BE_PAID" };
    set((s) => ({
      fiscalDocs: s.fiscalDocs.map((d) =>
        d.id === id ? { ...d, status: "paid" as const } : d,
      ),
    }));
    return { ok: true };
  },

  issueFiscal: ({
    kind,
    party,
    partyType,
    amount,
    guestName,
    stayRef,
    stayId,
  }) => {
    const docNo = kind === "PSBN" ? allocatePsbnNo() : allocateInvoiceNo();
    const doc: FiscalDoc = {
      id: crypto.randomUUID(),
      kind,
      docNo,
      party,
      partyType,
      amount,
      status: "issued",
      at: new Date().toISOString(),
      guestName,
      stayRef,
      stayId,
    };
    set((s) => ({ fiscalDocs: [doc, ...s.fiscalDocs] }));
    return doc;
  },

  issueStayTaxInvoice: (stayId) => {
    const fo = useFrontOfficeStore.getState();
    const stay = fo.stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    const gate = canIssueTaxInvoice(stay);
    if (!gate.ok) return gate;

    const existing = get().fiscalDocs.find(
      (d) =>
        d.stayId === stayId &&
        d.status !== "void" &&
        (d.kind === "INV" || d.kind === "PSBN"),
    );
    if (existing) {
      const linked = fo.attachTaxInvoice(stayId, {
        id: existing.id,
        docNo: existing.docNo,
        kind: existing.kind,
        at: existing.at,
      });
      if (!linked.ok) return linked;
      return { ok: true, doc: existing };
    }

    const totals = folioTotals(stay);
    const amount = Math.max(totals.charged, 0);
    if (amount <= 0) {
      return {
        ok: false,
        error: "No taxable charges on folio — post charges before tax invoice",
      };
    }

    const agentBill = stay.source === "agent" && Boolean(stay.agencyName?.trim());
    const kind = agentBill ? ("PSBN" as const) : ("INV" as const);
    const party = agentBill
      ? stay.agencyName!.trim()
      : stay.guestName.trim();
    const doc = get().issueFiscal({
      kind,
      party,
      partyType: agentBill ? "agent" : "guest",
      amount,
      guestName: stay.guestName,
      stayRef: stay.confirmationNo,
      stayId: stay.id,
    });
    const linked = fo.attachTaxInvoice(stayId, {
      id: doc.id,
      docNo: doc.docNo,
      kind: doc.kind,
      at: doc.at,
    });
    if (!linked.ok) return linked;
    return { ok: true, doc };
  },

  closeTillShift: (counted) => {
    const open = get().tillShifts.find((t) => !t.closedAt);
    const till = useFiscalStore.getState().tillBalance;
    const expected = open?.expected ?? till;
    const shift: TillShift = {
      id: open?.id ?? crypto.randomUUID(),
      openedAt: open?.openedAt ?? new Date().toISOString(),
      closedAt: new Date().toISOString(),
      openingFloat: open?.openingFloat ?? 10000,
      expected,
      counted,
      variance: counted - expected,
      cashier: open?.cashier ?? "Karma Dorji",
    };
    set((s) => ({
      tillShifts: [
        shift,
        ...s.tillShifts.filter((t) => t.id !== shift.id),
        {
          id: crypto.randomUUID(),
          openedAt: new Date().toISOString(),
          closedAt: null,
          openingFloat: counted,
          expected: counted,
          counted: null,
          variance: null,
          cashier: "Karma Dorji",
        },
      ],
    }));
    return shift;
  },

  matchDeposit: (amount, ref, shiftId) => {
    set((s) => ({
      bankDeposits: [
        {
          id: crypto.randomUUID(),
          amount,
          ref,
          matchedShiftId: shiftId,
          at: new Date().toISOString(),
        },
        ...s.bankDeposits,
      ],
    }));
  },

  forceChannelPush: async () => {
    const at = new Date().toLocaleTimeString();
    set((s) => ({
      lastForcePush: at,
      channelConns: s.channelConns.map((c) => ({
        ...c,
        status: "connected" as const,
        lastPush: "just now",
      })),
      lastChannelPushStatus: "queued" as const,
    }));
    const { newIdempotencyKey, runCommand } = await import("./api");
    const { ROOM_TYPE_IDS } = await import("./fo-remote");
    const remote = await runCommand<{
      channelBookingId: string;
      bookingId: string;
      folioId?: string;
    }>("channel.acceptBooking", {
      channelBookingId: crypto.randomUUID(),
      guestName: `Channel · demo ${at}`,
      roomTypeId: ROOM_TYPE_IDS.deluxe_twin,
      idempotencyKey: newIdempotencyKey(),
    });
    set({
      lastChannelPushStatus: remote.ok ? "accepted" : "failed",
      lastChannelPushError: remote.ok ? null : remote.error,
    });
    if (!remote.ok) {
      return { ok: false as const, error: remote.error };
    }
    void import("./front-office-store").then(({ useFrontOfficeStore }) => {
      void useFrontOfficeStore.getState().hydrateFromApi();
    });
    return { ok: true as const, bookingId: remote.data.bookingId };
  },

  setStopSell: (v) => set({ stopSell: v }),
  setMinStay: (n) => set({ minStay: Math.max(1, n) }),

  upsertGuide: (input) => {
    const existing = input.id
      ? get().guides.find((g) => g.id === input.id)
      : undefined;
    if (existing) {
      const next: GuideReg = {
        ...existing,
        name: input.name.trim(),
        tcr: input.tcr.trim(),
        phone: input.phone.trim(),
        languages: input.languages.trim(),
      };
      set((s) => ({
        guides: s.guides.map((g) => (g.id === existing.id ? next : g)),
      }));
      void import("./api").then(({ newIdempotencyKey, runCommand }) => {
        void runCommand("registry.upsertGuide", {
          name: next.name,
          cid: next.tcr || undefined,
          idempotencyKey: newIdempotencyKey(),
        });
      });
      return next;
    }
    const name = input.name.trim();
    const initials = name
      .split(/\s+/)
      .map((p) => p[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const row: GuideReg = {
      id: crypto.randomUUID(),
      name,
      tcr: input.tcr.trim(),
      phone: input.phone.trim(),
      languages: input.languages.trim() || "Dzongkha · English",
      verified: false,
      initials: initials || "GD",
      activeTours: [],
      mealVoucherActive: true,
      guideBed: null,
    };
    set((s) => ({ guides: [row, ...s.guides] }));
    void import("./api").then(({ newIdempotencyKey, runCommand }) => {
      void runCommand("registry.upsertGuide", {
        name: row.name,
        cid: row.tcr || undefined,
        idempotencyKey: row.id,
      }).then((remote) => {
        if (remote.ok && remote.data && typeof remote.data === "object" && "id" in remote.data) {
          const apiId = String((remote.data as { id: string }).id);
          set((s) => ({
            guides: s.guides.map((g) => (g.id === row.id ? { ...g, id: apiId } : g)),
          }));
        }
      });
    });
    return row;
  },

  issueVoucher: (memberId, points) => {
    const m = get().loyalty.find((x) => x.id === memberId);
    if (!m) return { ok: false, error: "Member not found" };
    if (points <= 0 || points > m.points) return { ok: false, error: "Insufficient points" };
    set((s) => ({
      loyalty: s.loyalty.map((x) =>
        x.id === memberId ? { ...x, points: x.points - points } : x,
      ),
    }));
    return { ok: true, code: `VCH-${Date.now().toString().slice(-6)}` };
  },

  enrolLoyalty: (name, phone) => {
    const m: LoyaltyMember = {
      id: crypto.randomUUID(),
      name,
      phone,
      tier: "norbu",
      points: 200,
      nights: 0,
    };
    set((s) => ({ loyalty: [m, ...s.loyalty] }));
    void import("./api").then(({ newIdempotencyKey, runCommand }) => {
      void runCommand("loyalty.enrol", {
        guestId: m.id,
        idempotencyKey: newIdempotencyKey(),
      }).then((remote) => {
        if (!remote.ok) {
          console.error("[loyalty] enrol remote failed", remote.error);
        }
      });
    });
    return m;
  },

  bookEvent: (input) => {
    const ev: EventBooking = { ...input, id: crypto.randomUUID(), status: "confirmed" };
    set((s) => ({ events: [ev, ...s.events] }));
    return ev;
  },

  invoiceEvent: (id) => {
    const ev = get().events.find((e) => e.id === id);
    if (!ev) return { ok: false, error: "Event not found" };
    get().issueFiscal({
      kind: "INV",
      party: ev.title,
      partyType: "agent",
      amount: Math.round(ev.netAmount * 1.21),
    });
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, status: "invoiced" } : e)),
    }));
    return { ok: true };
  },

  bookService: (input) => {
    const job: ServiceJob = { ...input, id: crypto.randomUUID(), status: "booked" };
    set((s) => ({ services: [job, ...s.services] }));
    return job;
  },

  advanceService: (id) => {
    set((s) => ({
      services: s.services.map((j) => {
        if (j.id !== id) return j;
        const next =
          j.status === "booked" ? "dispatched" : j.status === "dispatched" ? "done" : "done";
        return { ...j, status: next };
      }),
    }));
  },

  updateCms: (patch) => set((s) => ({ cms: { ...s.cms, ...patch } })),
  toggleCampaign: (id) =>
    set((s) => ({
      campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, active: !c.active } : c)),
    })),
  addCampaign: (c) =>
    set((s) => ({ campaigns: [{ ...c, id: crypto.randomUUID() }, ...s.campaigns] })),
  updateTemplates: (wa, email) => set({ waTemplate: wa, emailTemplate: email }),
  updateWebsite: (patch) => set((s) => ({ website: { ...s.website, ...patch } })),

  askAi: (q) => {
    const fo = useFrontOfficeStore.getState();
    const lower = q.toLowerCase();
    let a = "I can help with arrivals, balances, groups, and rooms. Try a more specific desk question.";
    if (lower.includes("unassigned") || lower.includes("yangphel")) {
      const list = fo.stays
        .filter((s) => !s.roomId && ["confirmed", "held"].includes(s.status))
        .map((s) => `${s.confirmationNo} · ${s.guestName} · ${s.typeCode}`)
        .join("\n");
      a = list
        ? `Unassigned arrivals:\n${list}`
        : "No unassigned near-term arrivals. Yangphel rooms are assigned.";
    } else if (lower.includes("balance") || lower.includes("folio")) {
      const open = fo.stays
        .filter((s) => s.status === "checked_in" && folioBalance(s) > 0)
        .map((s) => `${s.roomNumber} ${s.guestName}: ${formatNu(folioBalance(s))}`)
        .join("\n");
      a = open || "All in-house folios are settled.";
    } else if (lower.includes("dirty") || lower.includes("housekeep")) {
      const dirty = fo.rooms.filter((r) => r.hkStatus === "dirty").map((r) => r.number);
      a = dirty.length ? `Dirty rooms: ${dirty.join(", ")}` : "No dirty rooms.";
    } else if (lower.includes("review") || lower.includes("apology")) {
      a =
        "Draft apology:\n\nKuzuzangpo — thank you for sharing your experience. We sincerely regret the inconvenience with your stay. Our Front Office Manager will call today to make this right, including a complimentary MAP dinner for your next visit.\n\nWith respect,\nDemo Hotel";
    }
    set((s) => ({
      aiLog: [{ id: crypto.randomUUID(), q, a, at: new Date().toISOString() }, ...s.aiLog].slice(0, 20),
    }));
    return a;
  },

  ownerPulse: () => {
    const fo = useFrontOfficeStore.getState();
    const fnb = useFnbStore.getState();
    const fiscal = useFiscalStore.getState();
    const inHouse = fo.stays.filter((s) => s.status === "checked_in");
    const occ = fo.rooms.filter((r) => inHouse.some((s) => s.roomId === r.id)).length;
    const occPct = Math.round((occ / fo.rooms.length) * 100);
    const roomRev = inHouse.reduce((s, st) => s + st.nightlyNet, 0);
    const adr = occ ? Math.round(roomRev / occ) : 0;
    const revpar = Math.round(roomRev / fo.rooms.length);
    const gross =
      roomRev +
      fnb.orders.reduce((s, o) => s + o.total, 0) +
      fiscal.purchases.reduce((s, p) => s + p.grandTotalBtn, 0);
    const openShift = get().tillShifts.find((t) => !t.closedAt);
    const tillFlags: string[] = [];
    if (openShift && !openShift.counted) tillFlags.push("Till shift still open — not reconciled");
    if (fnb.cart.length > 0) tillFlags.push(`POS cart has ${fnb.cart.length} unsold lines`);
    const voidFlags = fnb.kots
      .filter((k) => k.status === "cancelled")
      .map((k) => `Voided KOT ${k.ticketNo}`);
    return { occPct, adr, revpar, gross: roomRev + fnb.orders.reduce((s, o) => s + o.total, 0), tillFlags, voidFlags };
  },
}));

export { formatNu };
