/**
 * FO board ↔ Fastify commands. Zustand is a cache; money/inventory mutations
 * sync through idempotent commands (memory store today, Postgres when DATABASE_URL).
 */
import { apiGet, newIdempotencyKey, runCommand, sessionPropertyId } from "./api";
import type {
  BookingSource,
  BookingStatus,
  HkStatus,
  MealPlan,
  Room,
  RoomTypeCode,
  Stay,
} from "./front-office-store";
import { propertyTaxBreakdown } from "./property-tax-policy";
import {
  normalizeRoomTypeCode,
  rateSheetTypeMeta,
} from "./rate-sheet-inventory";

/**
 * Fallback UUIDs only for empty demo-hotel seed — live/DEMO resolve from
 * `/v1/settings/snapshot` by rate-sheet code (never invent VAL/EXE on Pelbu).
 */
export const ROOM_TYPE_IDS: Record<string, string> = {
  deluxe_queen: "20000000-0000-4000-8000-0000000000d0",
  deluxe_king: "20000000-0000-4000-8000-0000000000d1",
  deluxe_twin: "20000000-0000-4000-8000-0000000000d2",
  suite: "20000000-0000-4000-8000-0000000000s1",
};

const TYPE_NAMES: Record<string, string> = {
  deluxe_queen: "Deluxe Queen",
  deluxe_king: "Deluxe King",
  deluxe_twin: "Deluxe Twin",
  suite: "Pelbu Suite",
};

const SOURCE_MAP: Record<BookingSource, "desk" | "agent_portal" | "web" | "ota" | "channel"> = {
  direct: "desk",
  walk_in: "desk",
  agent: "agent_portal",
  ota: "ota",
};

/** Map desk `rm-101` → stable API UUID. */
export function deskRoomToApiId(deskRoomId: string): string {
  const digits = deskRoomId.replace(/\D/g, "").padStart(12, "0").slice(-12);
  return `30000000-0000-4000-8000-${digits}`;
}

export function apiIdToDeskRoomId(
  apiRoomId: string,
  rooms: Room[],
  apiRooms?: { id: string; number: string }[],
): string | null {
  const byStable = rooms.find((r) => deskRoomToApiId(r.id) === apiRoomId);
  if (byStable) return byStable.id;
  if (apiRooms?.length) {
    const api = apiRooms.find((r) => r.id === apiRoomId);
    if (api) {
      const byNumber = rooms.find((r) => r.number === api.number);
      if (byNumber) return byNumber.id;
    }
  }
  return null;
}

async function ensureRoomType(typeCode: RoomTypeCode): Promise<string | null> {
  const code = normalizeRoomTypeCode(typeCode);
  const meta = rateSheetTypeMeta(code);
  try {
    const propertyId = sessionPropertyId();
    const snap = await apiGet<{
      ok: boolean;
      roomTypes: { id: string; code: string; name: string }[];
    }>(`/v1/settings/snapshot?propertyId=${propertyId}`);
    const hit = (snap.roomTypes ?? []).find(
      (t) => normalizeRoomTypeCode(t.code) === code || t.code === typeCode,
    );
    if (hit?.id) return hit.id;
  } catch (err) {
    console.error("[fo-remote] snapshot roomTypes lookup failed", err);
  }
  const roomTypeId = ROOM_TYPE_IDS[code];
  const res = await runCommand<{ id: string }>("settings.upsertRoomType", {
    code,
    name: TYPE_NAMES[code] ?? meta.name,
    baseOccupancy: 2,
    idempotencyKey: roomTypeId ?? newIdempotencyKey(),
  });
  if (!res.ok) {
    console.error("[fo-remote] upsertRoomType failed", res.error);
    return null;
  }
  return res.data.id ?? roomTypeId ?? null;
}

export async function ensureInventoryRemote(
  rooms: Room[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const typeIds = new Map<RoomTypeCode, string>();
  const types = [...new Set(rooms.map((r) => r.typeCode))];
  for (const code of types) {
    const id = await ensureRoomType(code);
    if (!id) return { ok: false, error: `ROOM_TYPE_SYNC_FAILED:${code}` };
    typeIds.set(code, id);
  }
  for (const room of rooms) {
    const roomTypeId = typeIds.get(room.typeCode) ?? ROOM_TYPE_IDS[room.typeCode];
    const apiId = deskRoomToApiId(room.id);
    const res = await runCommand<{ id: string }>("settings.createRoom", {
      roomTypeId,
      number: room.number,
      floor: String(room.floor),
      id: apiId,
      idempotencyKey: apiId,
    });
    if (!res.ok && !String(res.error).includes("already exists")) {
      console.error("[fo-remote] createRoom failed", room.number, res.error);
      /* Soft-fail individual rooms — do not mark whole FO offline. */
    }
  }
  return { ok: true };
}

export async function syncCreateReservationRemote(input: {
  stayId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  typeCode: RoomTypeCode;
  mealPlan: MealPlan;
  source: BookingSource;
  asHold?: boolean;
  /** Shared tour / multi-room party id (UUID). */
  groupId?: string | null;
  /** Tour operator label for partner portal hydrate. */
  agencyName?: string | null;
}): Promise<
  | {
      ok: true;
      bookingId: string;
      lineId: string;
      confirmationNo: string;
      folioId: string;
      agencyFolioId?: string;
      guestId?: string;
    }
  | { ok: false; error: string }
> {
  const roomTypeId = await ensureRoomType(input.typeCode);
  if (!roomTypeId) return { ok: false, error: "ROOM_TYPE_SYNC_FAILED" };

  const created = await runCommand<{
    bookingId: string;
    lineId: string;
    confirmationNo: string;
    folioId: string;
    agencyFolioId?: string;
    guestId?: string;
  }>("reservations.createReservation", {
    guestName: input.guestName,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    roomTypeId,
    mealPlan: input.mealPlan,
    source: SOURCE_MAP[input.source],
    confirm: !input.asHold,
    idempotencyKey: input.stayId,
    ...(input.groupId && isApiUuid(input.groupId) ? { groupId: input.groupId } : {}),
    ...(input.agencyName?.trim() ? { agencyName: input.agencyName.trim() } : {}),
  });
  if (!created.ok) return { ok: false, error: created.error };
  return {
    ok: true,
    bookingId: created.data.bookingId,
    lineId: created.data.lineId,
    confirmationNo: created.data.confirmationNo,
    folioId: created.data.folioId,
    agencyFolioId: created.data.agencyFolioId,
    guestId: created.data.guestId,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isApiUuid(id: string | undefined | null): id is string {
  return Boolean(id && UUID_RE.test(id));
}

export type FinanceChargeAck = {
  id: string;
  description: string;
  netAmount: number;
  scAmount: number;
  gstAmount: number;
  totalAmount: number;
  kind: string;
  stream?: string;
  postedAt?: string;
  balance: number;
  payerType?: "guest" | "agent";
};

export type FinancePaymentAck = {
  paymentId: string;
  amount: number;
  method: string;
  balance: number;
  description: string;
  totalAmount: number;
  netAmount: number;
  scAmount: number;
  gstAmount: number;
  kind: string;
  postedAt?: string;
  payerType?: "guest" | "agent";
};

export async function syncEnsureAgencyFolioRemote(
  bookingId: string,
): Promise<
  | { ok: true; agencyFolioId: string; created: boolean }
  | { ok: false; error: string }
> {
  if (!isApiUuid(bookingId)) {
    return { ok: false, error: "API_BOOKING_REQUIRED" };
  }
  const res = await runCommand<{ agencyFolioId: string; created: boolean }>(
    "reservations.ensureAgencyFolio",
    {
      bookingId,
      idempotencyKey: commandIdempotencyKey("agency-folio", bookingId),
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    agencyFolioId: res.data.agencyFolioId,
    created: res.data.created,
  };
}

export async function syncPostChargeRemote(input: {
  folioId: string;
  description: string;
  netAmount: number;
  kind: string;
  stream?: "master" | "personal";
  idempotencyKey?: string;
}): Promise<{ ok: true; data: FinanceChargeAck } | { ok: false; error: string }> {
  if (!isApiUuid(input.folioId)) {
    return { ok: false, error: "API_FOLIO_REQUIRED" };
  }
  const res = await runCommand<FinanceChargeAck>("finance.postCharge", {
    folioId: input.folioId,
    description: input.description,
    netAmount: input.netAmount,
    kind: input.kind,
    stream: input.stream,
    idempotencyKey: input.idempotencyKey ?? newIdempotencyKey(),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function syncPostPaymentRemote(input: {
  folioId: string;
  amount: number;
  method: "cash" | "card" | "mbob" | "bank" | "agent_credit" | "rma_qr" | "city_ledger";
  idempotencyKey?: string;
}): Promise<{ ok: true; data: FinancePaymentAck } | { ok: false; error: string }> {
  if (!isApiUuid(input.folioId)) {
    return { ok: false, error: "API_FOLIO_REQUIRED" };
  }
  const method =
    input.method === "rma_qr"
      ? "mbob"
      : input.method === "city_ledger"
        ? "agent_credit"
        : input.method;
  const res = await runCommand<FinancePaymentAck>("finance.postPayment", {
    folioId: input.folioId,
    amount: input.amount,
    method,
    idempotencyKey: input.idempotencyKey ?? newIdempotencyKey(),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function syncVoidLineRemote(input: {
  folioId: string;
  lineId: string;
  reason: string;
}): Promise<
  | {
      ok: true;
      data: {
        reversalId: string;
        originalLineId: string;
        balance: number;
        description: string;
        totalAmount: number;
        netAmount: number;
        kind: string;
        postedAt?: string;
      };
    }
  | { ok: false; error: string }
> {
  if (!isApiUuid(input.folioId) || !isApiUuid(input.lineId)) {
    return { ok: false, error: "API_FOLIO_LINE_REQUIRED" };
  }
  const res = await runCommand<{
    reversalId: string;
    originalLineId: string;
    balance: number;
    description: string;
    totalAmount: number;
    netAmount: number;
    kind: string;
    postedAt?: string;
  }>("finance.voidLineWithReversal", {
    folioId: input.folioId,
    lineId: input.lineId,
    reason: input.reason,
    idempotencyKey: commandIdempotencyKey(
      "void",
      input.folioId,
      input.lineId,
      input.reason,
    ),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function syncCheckoutGateRemote(
  apiBookingId: string,
): Promise<{ ok: true; cleared: boolean } | { ok: false; error: string }> {
  if (!isApiUuid(apiBookingId)) {
    return { ok: false, error: "API_BOOKING_REQUIRED" };
  }
  const res = await runCommand<{ cleared: boolean }>("stay.assertCheckoutGate", {
    bookingId: apiBookingId,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, cleared: Boolean(res.data.cleared) };
}

export async function syncAssignRoomRemote(input: {
  bookingLineId: string;
  deskRoomId: string;
  mode?: "assign" | "upgrade" | "move";
  reason?: string;
  dirtyOverridePin?: string;
}): Promise<{ ok: true; roomNumber: string; mode: string } | { ok: false; error: string }> {
  const mode = input.mode ?? "assign";
  const res = await runCommand<{ roomNumber: string; mode: string }>("stayview.assignRooms", {
    bookingLineId: input.bookingLineId,
    roomId: deskRoomToApiId(input.deskRoomId),
    mode,
    reason: input.reason,
    dirtyOverridePin: input.dirtyOverridePin,
    idempotencyKey: commandIdempotencyKey(
      "assign",
      input.bookingLineId,
      input.deskRoomId,
      mode,
      input.reason ?? "",
      input.dirtyOverridePin ? "dirty" : "clean",
    ),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, roomNumber: res.data.roomNumber, mode: res.data.mode };
}

export async function syncGuestIdentityRemote(input: {
  guestId?: string | null;
  fullName: string;
  passportOrCid: string;
  nationality?: string;
}): Promise<
  | { ok: true; guestId: string }
  | { ok: false; error: string }
> {
  const res = await runCommand<{ id: string }>("guests.upsert", {
    guestId: input.guestId && isApiUuid(input.guestId) ? input.guestId : undefined,
    fullName: input.fullName,
    passportOrCid: input.passportOrCid,
    nationality: input.nationality,
    idempotencyKey: commandIdempotencyKey(
      "guest-id",
      input.guestId ?? input.fullName,
      input.passportOrCid,
    ),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, guestId: res.data.id };
}

/** Hash string parts into a stable UUID (v4-shaped) for idempotency. */
export function commandIdempotencyKey(...parts: string[]): string {
  const raw = parts.join(":");
  let hex = "";
  for (let i = 0; i < raw.length; i += 1) {
    hex += raw.charCodeAt(i).toString(16).padStart(2, "0");
  }
  const dig = hex.replace(/[^0-9a-f]/gi, "").padEnd(12, "0").slice(0, 12);
  return `50000000-0000-4000-8000-${dig}`;
}

/**
 * Deterministic UUID for per-night package / extension charges (retry-safe).
 * Include netCents when rate can change so a rebuild posts a new line after void.
 */
export function folioNightIdempotencyKey(
  bookingId: string,
  kind: "room" | "fb" | "extra",
  stayDate: string,
  netCents = 0,
): string {
  const raw = `${bookingId}:${kind}:${stayDate}:${netCents}`;
  let hex = "";
  for (let i = 0; i < raw.length; i += 1) {
    hex += raw.charCodeAt(i).toString(16).padStart(2, "0");
  }
  const dig = hex.replace(/[^0-9a-f]/gi, "").padEnd(12, "0").slice(0, 12);
  return `40000000-0000-4000-8000-${dig}`;
}

export async function syncChangeDatesRemote(input: {
  bookingId: string;
  checkOut: string;
}): Promise<
  | {
      ok: true;
      data: {
        checkOut: string;
        addedNights: string[];
        removedNights: string[];
        nightlyNet: number;
        mealPlan: string;
      };
    }
  | { ok: false; error: string }
> {
  if (!isApiUuid(input.bookingId)) {
    return { ok: false, error: "API_BOOKING_REQUIRED" };
  }
  const res = await runCommand<{
    checkOut: string;
    addedNights: string[];
    removedNights: string[];
    nightlyNet: number;
    mealPlan: string;
  }>("stayview.changeDates", {
    bookingId: input.bookingId,
    checkOut: input.checkOut,
    idempotencyKey: commandIdempotencyKey("dates", input.bookingId, input.checkOut),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function syncBlockRoomRemote(input: {
  deskRoomId: string;
  fromDate: string;
  toDate: string;
  blockKind?: "ooo" | "oos" | "hold";
  reason: string;
}): Promise<
  | {
      ok: true;
      data: {
        id: string;
        roomId: string;
        blockKind: "ooo" | "oos" | "hold";
        fromDate: string;
        toDate: string;
        reason: string;
      };
    }
  | { ok: false; error: string }
> {
  const res = await runCommand<{
    id: string;
    roomId: string;
    blockKind: "ooo" | "oos" | "hold";
    fromDate: string;
    toDate: string;
    reason: string;
  }>("stayview.blockRoom", {
    roomId: deskRoomToApiId(input.deskRoomId),
    fromDate: input.fromDate,
    toDate: input.toDate,
    blockKind: input.blockKind ?? "ooo",
    reason: input.reason,
    idempotencyKey: commandIdempotencyKey(
      "block",
      input.deskRoomId,
      input.fromDate,
      input.toDate,
      input.blockKind ?? "ooo",
      input.reason,
    ),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function syncReleaseRoomBlockRemote(
  blockId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isApiUuid(blockId)) return { ok: false, error: "API_BLOCK_REQUIRED" };
  const res = await runCommand("stayview.releaseRoomBlock", {
    blockId,
    idempotencyKey: commandIdempotencyKey("release-block", blockId),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function syncCheckInRemote(
  apiBookingId: string,
  opts?: { dirtyOverridePin?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await runCommand("reservations.checkIn", {
    bookingId: apiBookingId,
    dirtyOverridePin: opts?.dirtyOverridePin,
    idempotencyKey: commandIdempotencyKey("checkin", apiBookingId),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function syncRevertCheckInRemote(
  apiBookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isApiUuid(apiBookingId)) {
    return { ok: false, error: "API_BOOKING_REQUIRED" };
  }
  const res = await runCommand("reservations.revertCheckIn", {
    bookingId: apiBookingId,
    idempotencyKey: commandIdempotencyKey("revert-checkin", apiBookingId),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function syncUpdateStayNotesRemote(
  apiBookingId: string,
  notes: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isApiUuid(apiBookingId)) {
    return { ok: false, error: "API_BOOKING_REQUIRED" };
  }
  const res = await runCommand("reservations.updateNotes", {
    bookingId: apiBookingId,
    notes,
    idempotencyKey: commandIdempotencyKey(
      "notes",
      apiBookingId,
      String(notes.length),
      notes.slice(0, 24),
    ),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export type GuestRosterRemoteAck = {
  bookingId: string;
  guestId: string;
  guestName: string;
  passportOrCid: string | null;
  nationality: string | null;
  companionName: string | null;
  companionPassportOrCid: string | null;
  companionNationality: string | null;
};

export async function syncUpdateGuestRosterRemote(input: {
  apiBookingId: string;
  guestName?: string;
  passportOrCid?: string;
  nationality?: string;
  companionName?: string | null;
  companionPassportOrCid?: string | null;
  companionNationality?: string | null;
}): Promise<
  { ok: true; data: GuestRosterRemoteAck } | { ok: false; error: string }
> {
  if (!isApiUuid(input.apiBookingId)) {
    return { ok: false, error: "API_BOOKING_REQUIRED" };
  }
  const companion = input.companionName?.trim() || "";
  const res = await runCommand<GuestRosterRemoteAck>(
    "reservations.updateGuestRoster",
    {
      bookingId: input.apiBookingId,
      guestName: input.guestName,
      passportOrCid: input.passportOrCid,
      nationality: input.nationality,
      companionName:
        input.companionName === undefined ? undefined : companion || null,
      companionPassportOrCid:
        input.companionPassportOrCid === undefined
          ? undefined
          : companion
            ? input.companionPassportOrCid?.trim() || null
            : null,
      companionNationality:
        input.companionNationality === undefined
          ? undefined
          : companion
            ? input.companionNationality?.trim() || null
            : null,
      idempotencyKey: commandIdempotencyKey(
        "roster",
        input.apiBookingId,
        input.guestName ?? "",
        input.passportOrCid ?? "",
        companion,
        input.companionPassportOrCid ?? "",
      ),
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function syncCheckOutRemote(
  apiBookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await runCommand("reservations.checkOut", {
    bookingId: apiBookingId,
    idempotencyKey: commandIdempotencyKey("checkout", apiBookingId),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function syncConfirmHoldRemote(
  apiBookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await runCommand("reservations.confirm", {
    bookingId: apiBookingId,
    idempotencyKey: commandIdempotencyKey("confirm", apiBookingId),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function syncCancelRemote(
  apiBookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await runCommand("reservations.cancel", {
    bookingId: apiBookingId,
    idempotencyKey: commandIdempotencyKey("cancel", apiBookingId),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function syncHkStatusRemote(input: {
  deskRoomId: string;
  status: HkStatus;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  /** Desk `occupied` is UI-only — API enums are clean|dirty|inspected|ooo. */
  const status: "clean" | "dirty" | "inspected" | "ooo" =
    input.status === "occupied" ? "inspected" : input.status;
  const res = await runCommand("housekeeping.setStatus", {
    roomId: deskRoomToApiId(input.deskRoomId),
    status,
    idempotencyKey: newIdempotencyKey(),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function syncNightAuditRemote(): Promise<
  | {
      ok: true;
      businessDate: string;
      nextDate: string;
      postedNights: number;
      noShows: number;
      expiredHolds: number;
      status: string;
    }
  | { ok: false; error: string }
> {
  const res = await runCommand<{
    businessDate: string;
    nextDate?: string;
    postedNights?: number;
    noShows?: number;
    expiredHolds?: number;
    status: string;
    idempotent?: boolean;
  }>("night_audit.run", {
    idempotencyKey: newIdempotencyKey(),
  });
  if (!res.ok) return { ok: false, error: res.error };
  const d = res.data;
  if (d.status === "already_closed" || d.idempotent) {
    return {
      ok: true,
      businessDate: d.businessDate,
      nextDate: d.nextDate ?? d.businessDate,
      postedNights: d.postedNights ?? 0,
      noShows: d.noShows ?? 0,
      expiredHolds: d.expiredHolds ?? 0,
      status: d.status,
    };
  }
  return {
    ok: true,
    businessDate: d.businessDate,
    nextDate: d.nextDate ?? d.businessDate,
    postedNights: d.postedNights ?? 0,
    noShows: d.noShows ?? 0,
    expiredHolds: d.expiredHolds ?? 0,
    status: d.status,
  };
}

type ApiFolioLine = {
  id: string;
  description: string;
  net: number;
  kind: string;
  sourceId?: string;
  stream?: "master" | "personal";
};

type ApiBooking = {
  notes?: string | null;
  id: string;
  confirmationNo: string;
  status: string;
  guestName: string;
  guestId?: string | null;
  passportOrCid?: string | null;
  nationality?: string | null;
  companionName?: string | null;
  companionPassportOrCid?: string | null;
  companionNationality?: string | null;
  checkIn: string;
  checkOut: string;
  source: string;
  agencyName?: string | null;
  groupId?: string | null;
  lines: {
    id: string;
    roomTypeId: string;
    mealPlan: string;
    roomId: string | null;
    netAmount: number | null;
  }[];
  folioBalance?: number;
  folioId?: string;
  agencyFolioId?: string;
  folioLines?: ApiFolioLine[];
};

function mapApiFolioKind(kind: string): Stay["folioLines"][number]["kind"] {
  if (
    kind === "room" ||
    kind === "fb" ||
    kind === "laundry" ||
    kind === "minibar" ||
    kind === "sc" ||
    kind === "bst" ||
    kind === "payment" ||
    kind === "adjustment"
  ) {
    return kind;
  }
  if (kind === "reversal" || kind === "charge") return "adjustment";
  return "adjustment";
}

function mapApiFolioLines(lines: ApiFolioLine[] | undefined): Stay["folioLines"] {
  if (!lines?.length) return [];
  return lines.map((l) => {
    const kind = mapApiFolioKind(l.kind);
    const net = l.net;
    // API memory lines store net; reconstruct SC/GST with the same property policy as desk posts.
    const isPayment = kind === "payment" || net < 0;
    if (isPayment) {
      return {
        id: l.id,
        postedAt: new Date().toISOString(),
        kind: "payment" as const,
        description: l.description,
        netAmount: net,
        scAmount: 0,
        bstAmount: 0,
        totalAmount: net,
        voided: false,
        // Agency folio payments must stay on master (never default to personal).
        stream: (l.stream ?? "personal") as "master" | "personal",
      };
    }
    const tax = propertyTaxBreakdown(Math.abs(net));
    const stream: "master" | "personal" =
      l.stream ??
      (kind === "room" || /meal plan/i.test(l.description) ? "master" : "personal");
    return {
      id: l.id,
      postedAt: new Date().toISOString(),
      kind,
      description: l.description,
      netAmount: tax.netAmount,
      scAmount: tax.scAmount,
      bstAmount: tax.bstAmount,
      totalAmount: tax.totalAmount,
      voided: false,
      stream,
    };
  });
}

function typeCodeFromApiRoomTypeId(id: string): RoomTypeCode {
  const entry = Object.entries(ROOM_TYPE_IDS).find(([, v]) => v === id);
  return normalizeRoomTypeCode(entry?.[0] ?? "deluxe_twin");
}

function mapApiStatus(status: string): BookingStatus {
  if (status === "expired") return "cancelled";
  if (
    status === "confirmed" ||
    status === "held" ||
    status === "checked_in" ||
    status === "checked_out" ||
    status === "cancelled" ||
    status === "no_show"
  ) {
    return status;
  }
  return "confirmed";
}

function mapApiSource(source: string): BookingSource {
  if (source === "agent_portal") return "agent";
  if (source === "ota" || source === "channel") return "ota";
  if (source === "web") return "direct";
  return "walk_in";
}

export function mapApiBookingToStay(
  b: ApiBooking,
  rooms: Room[],
  opts?: {
    apiRooms?: { id: string; number: string }[];
    roomTypes?: { id: string; code: string }[];
    groupsById?: Map<string, { name: string; agentId?: string | null }>;
  },
): Stay {
  const line = b.lines[0];
  const typeFromApi = line
    ? opts?.roomTypes?.find((t) => t.id === line.roomTypeId)?.code
    : undefined;
  const typeCode = normalizeRoomTypeCode(
    typeFromApi ?? (line ? typeCodeFromApiRoomTypeId(line.roomTypeId) : "deluxe_twin"),
  );
  const deskRoomId = line?.roomId
    ? apiIdToDeskRoomId(line.roomId, rooms, opts?.apiRooms)
    : null;
  const room = deskRoomId ? rooms.find((r) => r.id === deskRoomId) : null;
  const companionName = b.companionName?.trim() || "";
  const companions = companionName
    ? [
        {
          name: companionName,
          passportOrCid: b.companionPassportOrCid?.trim() || undefined,
          nationality: b.companionNationality?.trim() || undefined,
        },
      ]
    : undefined;
  const group = b.groupId ? opts?.groupsById?.get(b.groupId) : undefined;
  const groupName = group?.name?.trim() || null;
  const agencyName = b.agencyName?.trim() || groupName || null;
  return {
    id: b.id,
    confirmationNo: b.confirmationNo,
    status: mapApiStatus(b.status),
    guestName: b.guestName,
    guestPhone: "",
    guestEmail: "",
    nationality: b.nationality?.trim() || "International",
    /* Empty until desk captures ID — never seed "Pending" (blocks hover CI falsely). */
    passportOrCid: b.passportOrCid?.trim() || "",
    vip: false,
    apiGuestId: b.guestId ?? undefined,
    roomId: room?.id ?? null,
    roomNumber: room?.number ?? null,
    typeCode,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    mealPlan: ((line?.mealPlan as MealPlan) ?? "EP"),
    source: mapApiSource(b.source),
    nightlyNet: line?.netAmount ?? 3500,
    groupId: b.groupId ?? null,
    groupName,
    agencyName,
    folioLines: mapApiFolioLines(b.folioLines),
    audit: [],
    holdExpiresAt: b.status === "held" ? `${b.checkIn}T18:00:00` : null,
    depositPaid: 0,
    notes: b.notes?.trim() || undefined,
    companions,
    apiBookingId: b.id,
    apiBookingLineId: line?.id,
    apiFolioId: b.folioId,
    apiAgencyFolioId: b.agencyFolioId,
    syncPending: false,
  };
}

export type ApiRoomBlock = {
  id: string;
  roomId: string;
  blockKind: "ooo" | "oos" | "hold";
  fromDate: string;
  toDate: string;
  reason: string;
};

export type FoHydrateResult =
  | {
      ok: true;
      businessDate: string;
      bookings: ApiBooking[];
      roomBlocks: ApiRoomBlock[];
      rooms: Room[];
      apiRooms: { id: string; number: string }[];
      roomTypes: { id: string; code: string; name: string }[];
      groupsById: Map<string, { name: string; agentId?: string | null }>;
      kpis: {
        occupancyPct: number | null;
        arrivalsLeft: number;
        departuresLeft: number;
        dirtyRooms: number;
        openBalances: number;
      };
      alerts: { id: string; severity: string; text: string; href: string }[];
    }
  | { ok: false; error: string };

function deskRoomsFromApi(input: {
  rooms: { id: string; number: string; floor: string | null; hkStatus: string; roomTypeId: string }[];
  roomTypes: { id: string; code: string; name: string }[];
}): Room[] {
  const typeById = new Map(input.roomTypes.map((t) => [t.id, t]));
  return [...input.rooms]
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    .map((r) => {
      const t = typeById.get(r.roomTypeId);
      const floorNum = Number.parseInt(String(r.floor ?? r.number[0] ?? "1"), 10);
      const hk = r.hkStatus as HkStatus;
      return {
        id: `rm-${r.number}`,
        number: r.number,
        floor: Number.isFinite(floorNum) ? floorNum : 1,
        typeCode: normalizeRoomTypeCode(t?.code) || "deluxe_twin",
        typeName: t?.name || rateSheetTypeMeta(t?.code).name || "Room",
        hkStatus:
          hk === "clean" ||
          hk === "dirty" ||
          hk === "inspected" ||
          hk === "ooo" ||
          hk === "occupied"
            ? hk
            : "clean",
      } satisfies Room;
    });
}

export async function hydrateFrontOfficeRemote(): Promise<FoHydrateResult> {
  try {
    const propertyId = sessionPropertyId();
    const day = await apiGet<{
      ok: boolean;
      businessDate: string;
      kpis: {
        occupancyPct: number | null;
        arrivalsLeft: number;
        departuresLeft: number;
        dirtyRooms: number;
        openBalances: number;
      };
      alerts: { id: string; severity: string; text: string; href: string }[];
    }>(`/v1/desk/day?propertyId=${propertyId}`);
    const res = await apiGet<{
      ok: boolean;
      bookings: ApiBooking[];
      roomTypes?: { id: string; code: string; name: string }[];
      groups?: { id: string; name: string; agentId?: string | null }[];
    }>(`/v1/reservations?propertyId=${propertyId}`);
    const snap = await apiGet<{
      ok: boolean;
      rooms: {
        id: string;
        number: string;
        floor: string | null;
        hkStatus: string;
        roomTypeId: string;
      }[];
      roomTypes: { id: string; code: string; name: string }[];
    }>(`/v1/settings/snapshot?propertyId=${propertyId}`);
    let roomBlocks: ApiRoomBlock[] = [];
    try {
      const blocksRes = await apiGet<{
        ok: boolean;
        blocks: ApiRoomBlock[];
      }>(`/v1/stayview/blocks?propertyId=${propertyId}`);
      roomBlocks = blocksRes.blocks ?? [];
    } catch (err) {
      console.error("[fo-remote] stayview/blocks hydrate failed", err);
    }
    const roomTypes = snap.roomTypes ?? res.roomTypes ?? [];
    const apiRooms = (snap.rooms ?? []).map((r) => ({ id: r.id, number: r.number }));
    const rooms = deskRoomsFromApi({
      rooms: snap.rooms ?? [],
      roomTypes,
    });
    const groupsById = new Map(
      (res.groups ?? []).map((g) => [g.id, { name: g.name, agentId: g.agentId ?? null }]),
    );
    return {
      ok: true,
      businessDate: day.businessDate,
      bookings: res.bookings ?? [],
      roomBlocks,
      rooms,
      apiRooms,
      roomTypes,
      groupsById,
      kpis: day.kpis,
      alerts: day.alerts ?? [],
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "FO hydrate failed",
    };
  }
}

export function stayApiId(stay: Stay): string | undefined {
  return stay.apiBookingId;
}
