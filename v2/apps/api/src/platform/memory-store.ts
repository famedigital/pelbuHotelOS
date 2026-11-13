/** Dev-time in-memory tenant store until Postgres schema v2 is wired. No mock seed rows. */

export type RoomTypeRow = {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  baseOccupancy: number;
};

export type RoomRow = {
  id: string;
  propertyId: string;
  roomTypeId: string;
  number: string;
  floor: string | null;
  hkStatus: string;
};

export type StaffRow = {
  id: string;
  propertyId: string;
  displayName: string;
  role: string;
  pinSet: boolean;
  active: boolean;
};

export type RatePlanRow = {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  mealPlan: string;
  currency: string;
};

export type RateCell = {
  id: string;
  propertyId: string;
  ratePlanId: string;
  roomTypeId: string;
  stayDate: string;
  netAmount: number;
};

export type PropertyRow = {
  id: string;
  name: string;
  slug: string;
  scRate: number;
  gstRate: number;
  gstEnabled: boolean;
  currentBusinessDate: string;
  checkInTime: string;
  checkOutTime: string;
  bookingSeq: number;
};

export type GuestRow = {
  id: string;
  propertyId: string;
  fullName: string;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  vip: boolean;
  passportOrCid?: string | null;
};

export type GroupRow = {
  id: string;
  propertyId: string;
  name: string;
  agentId: string | null;
};

export type BookingLineRow = {
  id: string;
  bookingId: string;
  roomTypeId: string;
  ratePlanId: string | null;
  netAmount: number | null;
  mealPlan: string;
  roomId: string | null;
};

export type BookingRow = {
  id: string;
  propertyId: string;
  confirmationNo: string;
  status: string;
  guestId: string | null;
  guestName: string;
  agentId?: string | null;
  groupId: string | null;
  checkIn: string;
  checkOut: string;
  source: string;
  /** Tour operator display name — partner portal own-stays filter. */
  agencyName?: string | null;
  /** Desk stay notes — survive hydrate. */
  notes?: string | null;
  /** Sharing guest on the same room (Guests & Docs). */
  companionName?: string | null;
  companionPassportOrCid?: string | null;
  companionNationality?: string | null;
  lines: BookingLineRow[];
};

export type AssignmentRow = {
  id: string;
  propertyId: string;
  bookingLineId: string;
  bookingId: string;
  roomId: string;
  stayDate: string;
  active: boolean;
};

export type RoomBlockRow = {
  id: string;
  propertyId: string;
  roomId: string;
  blockKind: "ooo" | "oos" | "hold";
  fromDate: string;
  toDate: string;
  reason: string;
  releasedAt: string | null;
};

export type FolioRow = {
  id: string;
  propertyId: string;
  bookingId: string;
  payerType: "guest" | "agent";
  status: string;
  balance: number;
};

export type MenuItemRow = {
  id: string;
  propertyId: string;
  outletId: string;
  name: string;
  category: string;
  station: string;
  netPrice: number;
  active: boolean;
  eightySixed: boolean;
};

export type PosOrderLineRow = {
  id: string;
  menuItemId: string;
  name: string;
  station: string;
  qty: number;
  netUnit: number;
  note?: string;
  voided: boolean;
};

export type PosOrderRow = {
  id: string;
  propertyId: string;
  outletId: string;
  tableLabel: string;
  coverCount: number;
  status: "open" | "fired" | "billed" | "settled" | "void";
  bookingId: string | null;
  lines: PosOrderLineRow[];
  tender: string | null;
  invNo: string | null;
  folioPosted: boolean;
  net: number;
  total: number;
  createdAt: string;
};

export type KotTicketRow = {
  id: string;
  propertyId: string;
  orderId: string;
  ticketNo: string;
  station: string;
  status: "queued" | "preparing" | "ready" | "bumped" | "cancelled";
  tableLabel: string;
  createdAt: number;
  lines: { menuItemId: string; name: string; qty: number; note?: string }[];
};

export type PosShiftRow = {
  id: string;
  propertyId: string;
  outletId: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  openingFloatBtn: number;
  closingFloatBtn: number | null;
};

export type OutletRow = {
  id: string;
  propertyId: string;
  code: string;
  name: string;
};

export type HermesRole = "fo" | "manager" | "hk" | "kitchen" | "gm" | "agent";

export type HermesTopicKind =
  | "front_office"
  | "housekeeping"
  | "kitchen_pos"
  | "management_audit"
  | "guides_drivers";

export type TelegramPairTokenRow = {
  id: string;
  propertyId: string;
  token: string;
  role: HermesRole;
  /** When role=agent, bind chat to this commercial agent id. */
  agentId: string | null;
  expiresAt: string;
  usedAt: string | null;
  usedChatId: number | null;
  createdAt: string;
};

export type TelegramChatRow = {
  id: string;
  propertyId: string;
  chatId: number;
  chatType: "private" | "group" | "supergroup";
  role: HermesRole;
  status: "active" | "paused" | "revoked";
  displayName: string | null;
  tgUsername: string | null;
  agentId: string | null;
  activeMouPropertyId: string | null;
  pairedAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
};

/** Telegram user → staff role inside a property ops group. */
export type TelegramStaffLinkRow = {
  id: string;
  propertyId: string;
  tgUserId: number;
  staffName: string;
  role: Exclude<HermesRole, "agent">;
  linkedAt: string;
  active: boolean;
};

/** Forum topic thread_id → department. */
export type TelegramTopicRow = {
  id: string;
  propertyId: string;
  chatId: number;
  threadId: number;
  kind: HermesTopicKind;
};

export type TelegramEventRow = {
  id: string;
  propertyId: string;
  chatId: number | null;
  direction: "in" | "out" | "system";
  intent: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type TelegramDocOcr = {
  kind: "passport" | "sdf";
  fullName?: string;
  passportOrCid?: string;
  nationality?: string;
  sdfRef?: string;
  confidence?: number;
  raw?: Record<string, unknown>;
};

export type TelegramDocDraftRow = {
  id: string;
  propertyId: string;
  kind: "passport" | "sdf";
  status: "pending" | "applied" | "discarded";
  ocr: TelegramDocOcr;
  imageRef: string | null;
  suggestedStayId: string | null;
  appliedStayId: string | null;
  createdByChatId: number | null;
  createdAt: string;
  appliedAt: string | null;
};

/** Pending Telegram callback: draft → booking attach. */
export type HermesPendingAttach = {
  draftId: string;
  propertyId: string;
  chatId: number;
  asCompanion: boolean;
  expiresAt: number;
};

class MemoryStore {
  properties = new Map<string, PropertyRow>();
  roomTypes: RoomTypeRow[] = [];
  rooms: RoomRow[] = [];
  staff: StaffRow[] = [];
  ratePlans: RatePlanRow[] = [];
  rates: RateCell[] = [];
  guests: GuestRow[] = [];
  groups: GroupRow[] = [];
  bookings: BookingRow[] = [];
  roomBlocks: RoomBlockRow[] = [];
  assignments: AssignmentRow[] = [];
  folios: FolioRow[] = [];
  auditRuns: { propertyId: string; businessDate: string; status: string }[] = [];
  outlets: OutletRow[] = [];
  menuItems: MenuItemRow[] = [];
  posOrders: PosOrderRow[] = [];
  kotTickets: KotTicketRow[] = [];
  posShifts: PosShiftRow[] = [];
  posInvSeq = new Map<string, number>();
  kotSeq = new Map<string, number>();
  folioLines: {
    id: string;
    folioId: string;
    propertyId: string;
    description: string;
    net: number;
    sourceType: string;
    sourceId: string;
    /** Desk stream: agency folio lines are always master. */
    stream?: "master" | "personal";
  }[] = [];
  telegramPairTokens: TelegramPairTokenRow[] = [];
  telegramChats: TelegramChatRow[] = [];
  telegramEvents: TelegramEventRow[] = [];
  telegramDocDrafts: TelegramDocDraftRow[] = [];
  telegramStaffLinks: TelegramStaffLinkRow[] = [];
  telegramTopics: TelegramTopicRow[] = [];
  /** Agent MoU links for Hermes gate (memory mirror of desk mou-store). */
  mouLinks: {
    id: string;
    propertyId: string;
    agentId: string;
    status: "draft" | "pending_counterparty" | "active" | "suspended" | "expired" | "rejected";
  }[] = [];
  hermesPendingAttach = new Map<string, HermesPendingAttach>();

  ensureDemoProperty(propertyId: string): PropertyRow {
    let p = this.properties.get(propertyId);
    if (!p) {
      p = {
        id: propertyId,
        name: "Demo Hotel",
        slug: "demo-hotel",
        scRate: 0.1,
        gstRate: 0.05,
        gstEnabled: true,
        currentBusinessDate: new Date().toISOString().slice(0, 10),
        checkInTime: "14:00",
        checkOutTime: "12:00",
        bookingSeq: 0,
      };
      this.properties.set(propertyId, p);
    }
    return p;
  }

  nextBookingSeq(propertyId: string): number {
    const p = this.ensureDemoProperty(propertyId);
    p.bookingSeq += 1;
    return p.bookingSeq;
  }

  datesBetween(checkIn: string, checkOut: string): string[] {
    const out: string[] = [];
    const cur = new Date(checkIn + "T00:00:00Z");
    const end = new Date(checkOut + "T00:00:00Z");
    while (cur < end) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  }

  /** Seed outlet + server-priced menu once per property (catalog, not demo tickets). */
  ensurePosCatalog(propertyId: string): { outletId: string } {
    this.ensureDemoProperty(propertyId);
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const restId = "10000000-0000-4000-8000-0000000000a1";
    const barId = "10000000-0000-4000-8000-0000000000a2";
    /* Repair legacy seed IDs that used letter `o` (invalid UUID hex). */
    for (const o of this.outlets) {
      if (o.propertyId !== propertyId) continue;
      if (o.code === "REST" && !UUID_RE.test(o.id)) o.id = restId;
      if (o.code === "BAR" && !UUID_RE.test(o.id)) o.id = barId;
    }
    let outlet = this.outlets.find((o) => o.propertyId === propertyId);
    if (!outlet) {
      outlet = {
        id: restId,
        propertyId,
        code: "REST",
        name: "Main Restaurant",
      };
      this.outlets.push(outlet);
      this.outlets.push({
        id: barId,
        propertyId,
        code: "BAR",
        name: "Lobby Bar",
      });
    }
    if (!this.menuItems.some((m) => m.propertyId === propertyId)) {
      const rows: Omit<MenuItemRow, "propertyId" | "outletId" | "active" | "eightySixed">[] = [
        { id: "10000000-0000-4000-8000-000000000101", name: "Ema Datshi", category: "restaurant", station: "kitchen", netPrice: 380 },
        { id: "10000000-0000-4000-8000-000000000102", name: "Shakam Paa", category: "restaurant", station: "kitchen", netPrice: 450 },
        { id: "10000000-0000-4000-8000-000000000103", name: "Beef Momos (6)", category: "restaurant", station: "kitchen", netPrice: 280 },
        { id: "10000000-0000-4000-8000-000000000104", name: "Dal Bhat Set", category: "restaurant", station: "kitchen", netPrice: 350 },
        { id: "10000000-0000-4000-8000-000000000201", name: "Red Panda Lager", category: "bar", station: "bar", netPrice: 180 },
        { id: "10000000-0000-4000-8000-000000000202", name: "Fresh Lime Soda", category: "bar", station: "bar", netPrice: 120 },
        { id: "10000000-0000-4000-8000-000000000301", name: "Suja (Butter Tea)", category: "cafe", station: "pass", netPrice: 80 },
        { id: "10000000-0000-4000-8000-000000000302", name: "Butter Croissant", category: "cafe", station: "bakery", netPrice: 160 },
        { id: "10000000-0000-4000-8000-000000000401", name: "RS · MAP Dinner Tray", category: "room_service", station: "kitchen", netPrice: 850 },
        /* Desk legacy m-* → deterministic UUID (menuIdToUuid) */
        { id: "10000000-0000-4000-8000-e1c1db8baa00", name: "Phaksha Paa", category: "restaurant", station: "kitchen", netPrice: 420 },
        { id: "10000000-0000-4000-8000-8fcc2aafea00", name: "Kewa Datshi", category: "restaurant", station: "kitchen", netPrice: 320 },
        { id: "10000000-0000-4000-8000-620da6c8aa00", name: "Jasha Maru", category: "restaurant", station: "kitchen", netPrice: 400 },
        { id: "10000000-0000-4000-8000-33e50eefe000", name: "Veg Momos (6)", category: "restaurant", station: "kitchen", netPrice: 240 },
        { id: "10000000-0000-4000-8000-8aff15f8a000", name: "Thukpa", category: "restaurant", station: "kitchen", netPrice: 300 },
        { id: "10000000-0000-4000-8000-bb4997a4aad0", name: "Seasonal Salad", category: "restaurant", station: "pass", netPrice: 220 },
        { id: "10000000-0000-4000-8000-e2ccb91dd000", name: "Druk 11000", category: "bar", station: "bar", netPrice: 200 },
        { id: "10000000-0000-4000-8000-b3888c8baa00", name: "Ara Shot", category: "bar", station: "bar", netPrice: 150 },
        { id: "10000000-0000-4000-8000-483382c6e000", name: "House Wine Glass", category: "bar", station: "bar", netPrice: 350 },
        { id: "10000000-0000-4000-8000-7069d3400000", name: "Whisky Pour", category: "bar", station: "bar", netPrice: 450 },
        { id: "10000000-0000-4000-8000-d20593e2aa00", name: "Ngaja", category: "cafe", station: "pass", netPrice: 90 },
        { id: "10000000-0000-4000-8000-9c5e9883ee00", name: "Espresso", category: "cafe", station: "pass", netPrice: 120 },
        { id: "10000000-0000-4000-8000-e813839bcae0", name: "Cake Slice", category: "cafe", station: "bakery", netPrice: 180 },
        { id: "10000000-0000-4000-8000-3540980cbeaf", name: "RS · Breakfast Tray", category: "room_service", station: "kitchen", netPrice: 650 },
        { id: "10000000-0000-4000-8000-75957babf000", name: "RS · Fruit Platter", category: "room_service", station: "pass", netPrice: 280 },
        { id: "10000000-0000-4000-8000-30d4a442babf", name: "Banquet Buffet /pax", category: "banquet", station: "kitchen", netPrice: 1200 },
        { id: "10000000-0000-4000-8000-173f31b8baea", name: "Conference Tea Set", category: "banquet", station: "pass", netPrice: 180 },
        { id: "10000000-0000-4000-8000-41a9c638bae0", name: "Jain Banquet Plate", category: "banquet", station: "kitchen", netPrice: 950 },
      ];
      for (const r of rows) {
        this.menuItems.push({
          ...r,
          propertyId,
          outletId: outlet.id,
          active: true,
          eightySixed: false,
        });
      }
    }
    return { outletId: outlet.id };
  }

  nextPosInv(propertyId: string): string {
    const n = (this.posInvSeq.get(propertyId) ?? 880) + 1;
    this.posInvSeq.set(propertyId, n);
    return `INV-POS-${n}`;
  }

  nextKotNo(propertyId: string): string {
    const n = (this.kotSeq.get(propertyId) ?? 240) + 1;
    this.kotSeq.set(propertyId, n);
    return `KOT-${String(n).padStart(4, "0")}`;
  }

  /** Replace FO memory from Postgres boot snapshot (additive merge by id). */
  applyFrontOfficeSnapshot(snap: {
    properties: {
      id: string;
      name: string;
      slug: string;
      scRate: number;
      gstRate: number;
      gstEnabled: boolean;
      currentBusinessDate: string;
    }[];
    roomTypes: RoomTypeRow[];
    rooms: RoomRow[];
    guests: GuestRow[];
    groups?: GroupRow[];
    bookings: BookingRow[];
    assignments: AssignmentRow[];
    roomBlocks?: RoomBlockRow[];
    folios: FolioRow[];
    folioLines: {
      id: string;
      folioId: string;
      propertyId: string;
      description: string;
      net: number;
      sourceType: string;
      sourceId: string;
    }[];
  }): { bookings: number; folios: number; lines: number; blocks: number; groups: number } {
    for (const p of snap.properties) {
      const existing = this.properties.get(p.id);
      const hydratedForProp = snap.bookings.filter((b) => b.propertyId === p.id).length;
      /* Avoid confirmation_no collisions with rows already in Postgres. */
      const seqFloor = hydratedForProp + 10_000;
      this.properties.set(p.id, {
        id: p.id,
        name: p.name,
        slug: p.slug,
        scRate: p.scRate,
        gstRate: p.gstRate,
        gstEnabled: p.gstEnabled,
        currentBusinessDate: p.currentBusinessDate,
        checkInTime: existing?.checkInTime ?? "14:00",
        checkOutTime: existing?.checkOutTime ?? "12:00",
        bookingSeq: Math.max(existing?.bookingSeq ?? 0, seqFloor),
      });
    }
    for (const t of snap.roomTypes) {
      if (!this.roomTypes.some((x) => x.id === t.id)) this.roomTypes.push(t);
    }
    for (const r of snap.rooms) {
      if (!this.rooms.some((x) => x.id === r.id)) this.rooms.push(r);
    }
    for (const g of snap.guests) {
      if (!this.guests.some((x) => x.id === g.id)) this.guests.push(g);
    }
    for (const g of snap.groups ?? []) {
      const idx = this.groups.findIndex((x) => x.id === g.id);
      if (idx >= 0) this.groups[idx] = g;
      else this.groups.push(g);
    }
    for (const b of snap.bookings) {
      const idx = this.bookings.findIndex((x) => x.id === b.id);
      if (idx >= 0) this.bookings[idx] = b;
      else this.bookings.push(b);
    }
    for (const a of snap.assignments) {
      if (!a.bookingId) continue;
      const idx = this.assignments.findIndex((x) => x.id === a.id);
      if (idx >= 0) this.assignments[idx] = a;
      else this.assignments.push(a);
    }
    for (const b of snap.roomBlocks ?? []) {
      const idx = this.roomBlocks.findIndex((x) => x.id === b.id);
      if (idx >= 0) this.roomBlocks[idx] = b;
      else this.roomBlocks.push(b);
    }
    for (const f of snap.folios) {
      const idx = this.folios.findIndex((x) => x.id === f.id);
      if (idx >= 0) this.folios[idx] = f;
      else this.folios.push(f);
    }
    for (const l of snap.folioLines) {
      if (!this.folioLines.some((x) => x.id === l.id)) this.folioLines.push(l);
    }
    return {
      bookings: snap.bookings.length,
      folios: snap.folios.length,
      lines: snap.folioLines.length,
      blocks: (snap.roomBlocks ?? []).length,
      groups: (snap.groups ?? []).length,
    };
  }
}

export const store = new MemoryStore();
