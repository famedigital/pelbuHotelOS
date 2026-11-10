/**
 * Front-office durable writes into schema v2 when DATABASE_URL is bound.
 * Memory store remains the fast path; these functions dual-write for restart survival.
 * SOURCE-MAP: REINVENT — schema v2 bookings/folios/folio_lines/payments.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  agents,
  bookingLines,
  bookings,
  folioLines,
  folios,
  groups,
  guests,
  organizations,
  payments,
  properties,
  roomAssignments,
  roomBlocks,
  rooms,
  roomTypes,
} from "./schema.js";

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function ensureProperty(db: Db, propertyId: string): Promise<void> {
  const existing = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (existing[0]?.id) return;

  /* Bootstrap only for brand-new propertyIds (dev/tests) — never invent orgs for live tenants. */
  const orgId = "00000000-0000-4000-8000-0000000000a1";
  await db
    .insert(organizations)
    .values({ id: orgId, name: "Demo Org" })
    .onConflictDoNothing();
  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(properties)
    .values({
      id: propertyId,
      organizationId: orgId,
      name: "Demo Hotel",
      slug: `demo-${propertyId.slice(0, 8)}`,
      currentBusinessDate: today,
    })
    .onConflictDoNothing();
}

export async function createReservationPersist(
  db: Db,
  input: {
    propertyId: string;
    bookingId: string;
    lineId: string;
    folioId: string;
    agencyFolioId?: string;
    guestId: string;
    guestName: string;
    confirmationNo: string;
    status: string;
    checkIn: string;
    checkOut: string;
    roomTypeId: string;
    ratePlanId: string | null;
    mealPlan: string;
    source: string;
    groupId: string | null;
    netAmount: number | null;
    roomTypeCode?: string;
    roomTypeName?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await ensureProperty(db, input.propertyId);
    await db.transaction(async (tx) => {
      await tx
        .insert(roomTypes)
        .values({
          id: input.roomTypeId,
          propertyId: input.propertyId,
          code: input.roomTypeCode ?? "DLX-K",
          name: input.roomTypeName ?? "Deluxe King",
          baseOccupancy: 2,
        })
        .onConflictDoNothing();
      await tx
        .insert(guests)
        .values({
          id: input.guestId,
          propertyId: input.propertyId,
          fullName: input.guestName,
        })
        .onConflictDoNothing();
      await tx.insert(bookings).values({
        id: input.bookingId,
        propertyId: input.propertyId,
        confirmationNo: input.confirmationNo,
        status: input.status,
        guestId: input.guestId,
        groupId: input.groupId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        source: input.source,
      });
      await tx.insert(bookingLines).values({
        id: input.lineId,
        propertyId: input.propertyId,
        bookingId: input.bookingId,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
        netAmount: input.netAmount != null ? money(input.netAmount) : null,
        mealPlan: input.mealPlan,
      });
      await tx.insert(folios).values({
        id: input.folioId,
        propertyId: input.propertyId,
        bookingId: input.bookingId,
        payerType: "guest",
        guestId: input.guestId,
        status: "open",
      });
      if (input.agencyFolioId) {
        await tx.insert(folios).values({
          id: input.agencyFolioId,
          propertyId: input.propertyId,
          bookingId: input.bookingId,
          payerType: "agent",
          status: "open",
        });
      }
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) return { ok: true };
    console.error("[fo-persist] createReservationPersist failed", { err: msg });
    return { ok: false, error: "FO_CREATE_PERSIST_FAILED" };
  }
}

export async function ensureAgencyFolioPersist(
  db: Db,
  input: {
    propertyId: string;
    bookingId: string;
    agencyFolioId: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.insert(folios).values({
      id: input.agencyFolioId,
      propertyId: input.propertyId,
      bookingId: input.bookingId,
      payerType: "agent",
      status: "open",
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) return { ok: true };
    console.error("[fo-persist] ensureAgencyFolioPersist failed", { err: msg });
    return { ok: false, error: "FO_AGENCY_FOLIO_PERSIST_FAILED" };
  }
}

export async function updateBookingStatusPersist(
  db: Db,
  input: { propertyId: string; bookingId: string; status: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db
      .update(bookings)
      .set({ status: input.status, version: sql`${bookings.version} + 1` })
      .where(
        and(
          eq(bookings.id, input.bookingId),
          eq(bookings.propertyId, input.propertyId),
        ),
      );
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] updateBookingStatusPersist failed", { err: msg });
    return { ok: false, error: "FO_STATUS_PERSIST_FAILED" };
  }
}

export async function updateBookingNotesPersist(
  db: Db,
  input: { propertyId: string; bookingId: string; notes: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db
      .update(bookings)
      .set({ notes: input.notes, version: sql`${bookings.version} + 1` })
      .where(
        and(
          eq(bookings.id, input.bookingId),
          eq(bookings.propertyId, input.propertyId),
        ),
      );
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] updateBookingNotesPersist failed", { err: msg });
    return { ok: false, error: "FO_NOTES_PERSIST_FAILED" };
  }
}

export async function upsertGuestPersist(
  db: Db,
  input: {
    propertyId: string;
    guestId: string;
    fullName: string;
    nationality?: string | null;
    phone?: string | null;
    email?: string | null;
    vip?: boolean;
    passportOrCid?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db
      .insert(guests)
      .values({
        id: input.guestId,
        propertyId: input.propertyId,
        fullName: input.fullName,
        nationality: input.nationality ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        vip: input.vip ?? false,
        passportOrCid: input.passportOrCid ?? null,
      })
      .onConflictDoUpdate({
        target: guests.id,
        set: {
          fullName: input.fullName,
          nationality: input.nationality ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          vip: input.vip ?? false,
          passportOrCid: input.passportOrCid ?? null,
          version: sql`${guests.version} + 1`,
        },
      });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] upsertGuestPersist failed", { err: msg });
    return { ok: false, error: "FO_GUEST_PERSIST_FAILED" };
  }
}

export async function updateBookingGuestRosterPersist(
  db: Db,
  input: {
    propertyId: string;
    bookingId: string;
    guestId: string | null;
    companionName: string | null;
    companionPassportOrCid: string | null;
    companionNationality: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db
      .update(bookings)
      .set({
        guestId: input.guestId,
        companionName: input.companionName,
        companionPassportOrCid: input.companionPassportOrCid,
        companionNationality: input.companionNationality,
        version: sql`${bookings.version} + 1`,
      })
      .where(
        and(
          eq(bookings.id, input.bookingId),
          eq(bookings.propertyId, input.propertyId),
        ),
      );
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] updateBookingGuestRosterPersist failed", {
      err: msg,
    });
    return { ok: false, error: "FO_ROSTER_PERSIST_FAILED" };
  }
}

export async function postChargePersist(
  db: Db,
  input: {
    propertyId: string;
    folioId: string;
    lineId: string;
    kind: string;
    description: string;
    netAmount: number;
    scAmount: number;
    gstAmount: number;
    totalAmount: number;
    idempotencyKey: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.insert(folioLines).values({
      id: input.lineId,
      propertyId: input.propertyId,
      folioId: input.folioId,
      kind: input.kind,
      description: input.description,
      netAmount: money(input.netAmount),
      scAmount: money(input.scAmount),
      gstAmount: money(input.gstAmount),
      totalAmount: money(input.totalAmount),
      idempotencyKey: input.idempotencyKey,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) return { ok: true };
    console.error("[fo-persist] postChargePersist failed", { err: msg });
    return { ok: false, error: "FO_CHARGE_PERSIST_FAILED" };
  }
}

export async function postPaymentPersist(
  db: Db,
  input: {
    propertyId: string;
    folioId: string;
    paymentId: string;
    method: string;
    amount: number;
    idempotencyKey: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.transaction(async (tx) => {
      await tx.insert(payments).values({
        id: input.paymentId,
        propertyId: input.propertyId,
        folioId: input.folioId,
        method: input.method,
        amount: money(input.amount),
        idempotencyKey: input.idempotencyKey,
      });
      await tx.insert(folioLines).values({
        id: input.paymentId,
        propertyId: input.propertyId,
        folioId: input.folioId,
        kind: "payment",
        description: `Payment · ${input.method}`,
        netAmount: money(-input.amount),
        scAmount: money(0),
        gstAmount: money(0),
        totalAmount: money(-input.amount),
        idempotencyKey: input.idempotencyKey,
      });
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) return { ok: true };
    console.error("[fo-persist] postPaymentPersist failed", { err: msg });
    return { ok: false, error: "FO_PAYMENT_PERSIST_FAILED" };
  }
}

export async function advanceBusinessDatePersist(
  db: Db,
  input: { propertyId: string; nextDate: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await ensureProperty(db, input.propertyId);
    await db
      .update(properties)
      .set({
        currentBusinessDate: input.nextDate,
        version: sql`${properties.version} + 1`,
      })
      .where(eq(properties.id, input.propertyId));
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] advanceBusinessDatePersist failed", { err: msg });
    return { ok: false, error: "FO_AUDIT_DATE_PERSIST_FAILED" };
  }
}

export async function assignRoomsPersist(
  db: Db,
  input: {
    propertyId: string;
    bookingLineId: string;
    roomId: string;
    stayDates: string[];
    assignmentIds: string[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(roomAssignments)
        .set({ active: false, version: sql`${roomAssignments.version} + 1` })
        .where(
          and(
            eq(roomAssignments.propertyId, input.propertyId),
            eq(roomAssignments.bookingLineId, input.bookingLineId),
            eq(roomAssignments.active, true),
          ),
        );
      for (let i = 0; i < input.stayDates.length; i++) {
        const stayDate = input.stayDates[i]!;
        const id = input.assignmentIds[i] ?? crypto.randomUUID();
        await tx.insert(roomAssignments).values({
          id,
          propertyId: input.propertyId,
          bookingLineId: input.bookingLineId,
          roomId: input.roomId,
          stayDate,
          active: true,
        });
      }
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] assignRoomsPersist failed", { err: msg });
    return { ok: false, error: "FO_ASSIGN_PERSIST_FAILED" };
  }
}

export async function changeBookingDatesPersist(
  db: Db,
  input: {
    propertyId: string;
    bookingId: string;
    checkOut: string;
    bookingLineId?: string;
    roomId?: string | null;
    addedNights?: string[];
    removedNights?: string[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({
          checkOut: input.checkOut,
          version: sql`${bookings.version} + 1`,
        })
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.propertyId, input.propertyId),
          ),
        );
      if (input.bookingLineId && input.removedNights?.length) {
        for (const stayDate of input.removedNights) {
          await tx
            .update(roomAssignments)
            .set({ active: false, version: sql`${roomAssignments.version} + 1` })
            .where(
              and(
                eq(roomAssignments.propertyId, input.propertyId),
                eq(roomAssignments.bookingLineId, input.bookingLineId),
                eq(roomAssignments.stayDate, stayDate),
                eq(roomAssignments.active, true),
              ),
            );
        }
      }
      if (input.bookingLineId && input.roomId && input.addedNights?.length) {
        for (const stayDate of input.addedNights) {
          await tx.insert(roomAssignments).values({
            id: crypto.randomUUID(),
            propertyId: input.propertyId,
            bookingLineId: input.bookingLineId,
            roomId: input.roomId,
            stayDate,
            active: true,
          });
        }
      }
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] changeBookingDatesPersist failed", { err: msg });
    return { ok: false, error: "FO_DATES_PERSIST_FAILED" };
  }
}

export async function blockRoomPersist(
  db: Db,
  input: {
    id: string;
    propertyId: string;
    roomId: string;
    blockKind: "ooo" | "oos" | "hold";
    fromDate: string;
    toDate: string;
    reason: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.transaction(async (tx) => {
      await tx.insert(roomBlocks).values({
        id: input.id,
        propertyId: input.propertyId,
        roomId: input.roomId,
        blockKind: input.blockKind,
        fromDate: input.fromDate,
        toDate: input.toDate,
        reason: input.reason,
      });
      if (input.blockKind === "ooo") {
        await tx
          .update(rooms)
          .set({
            hkStatus: "ooo",
            version: sql`${rooms.version} + 1`,
          })
          .where(
            and(eq(rooms.id, input.roomId), eq(rooms.propertyId, input.propertyId)),
          );
      }
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] blockRoomPersist failed", { err: msg });
    return { ok: false, error: "FO_BLOCK_PERSIST_FAILED" };
  }
}

export async function releaseRoomBlockPersist(
  db: Db,
  input: { propertyId: string; blockId: string },
): Promise<{ ok: true; roomId: string | null } | { ok: false; error: string }> {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(roomBlocks)
        .where(
          and(
            eq(roomBlocks.id, input.blockId),
            eq(roomBlocks.propertyId, input.propertyId),
          ),
        )
        .limit(1);
      const row = existing[0];
      if (!row) return { ok: false as const, error: "BLOCK_NOT_FOUND" };
      if (row.releasedAt) return { ok: true as const, roomId: row.roomId };
      await tx
        .update(roomBlocks)
        .set({
          releasedAt: new Date(),
          version: sql`${roomBlocks.version} + 1`,
        })
        .where(eq(roomBlocks.id, input.blockId));
      if (row.blockKind === "ooo") {
        const stillOoo = await tx
          .select({ id: roomBlocks.id })
          .from(roomBlocks)
          .where(
            and(
              eq(roomBlocks.roomId, row.roomId),
              eq(roomBlocks.blockKind, "ooo"),
              sql`${roomBlocks.releasedAt} is null`,
            ),
          )
          .limit(1);
        if (stillOoo.length === 0) {
          await tx
            .update(rooms)
            .set({
              hkStatus: "dirty",
              version: sql`${rooms.version} + 1`,
            })
            .where(eq(rooms.id, row.roomId));
        }
      }
      return { ok: true as const, roomId: row.roomId };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] releaseRoomBlockPersist failed", { err: msg });
    return { ok: false, error: "FO_UNBLOCK_PERSIST_FAILED" };
  }
}

export async function voidLineWithReversalPersist(
  db: Db,
  input: {
    propertyId: string;
    folioId: string;
    reversalId: string;
    originalLineId: string;
    description: string;
    netAmount: number;
    scAmount: number;
    gstAmount: number;
    totalAmount: number;
    idempotencyKey: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.insert(folioLines).values({
      id: input.reversalId,
      propertyId: input.propertyId,
      folioId: input.folioId,
      kind: "adjustment",
      description: input.description,
      netAmount: money(input.netAmount),
      scAmount: money(input.scAmount),
      gstAmount: money(input.gstAmount),
      totalAmount: money(input.totalAmount),
      idempotencyKey: input.idempotencyKey,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) return { ok: true };
    console.error("[fo-persist] voidLineWithReversalPersist failed", { err: msg });
    return { ok: false, error: "FO_VOID_PERSIST_FAILED" };
  }
}

export type FoHydrateSnapshot = {
  properties: {
    id: string;
    name: string;
    slug: string;
    scRate: number;
    gstRate: number;
    gstEnabled: boolean;
    currentBusinessDate: string;
  }[];
  roomTypes: {
    id: string;
    propertyId: string;
    code: string;
    name: string;
    baseOccupancy: number;
  }[];
  rooms: {
    id: string;
    propertyId: string;
    roomTypeId: string;
    number: string;
    floor: string | null;
    hkStatus: string;
  }[];
  guests: {
    id: string;
    propertyId: string;
    fullName: string;
    nationality: string | null;
    phone: string | null;
    email: string | null;
    vip: boolean;
    passportOrCid?: string | null;
  }[];
  groups: {
    id: string;
    propertyId: string;
    name: string;
    agentId: string | null;
  }[];
  bookings: {
    id: string;
    propertyId: string;
    confirmationNo: string;
    status: string;
    guestId: string | null;
    guestName: string;
    agentId: string | null;
    /** Resolved travel-agent display name for desk Agency bill. */
    agencyName: string | null;
    groupId: string | null;
    checkIn: string;
    checkOut: string;
    source: string;
    notes?: string | null;
    companionName?: string | null;
    companionPassportOrCid?: string | null;
    companionNationality?: string | null;
    lines: {
      id: string;
      bookingId: string;
      roomTypeId: string;
      ratePlanId: string | null;
      netAmount: number | null;
      mealPlan: string;
      roomId: string | null;
    }[];
  }[];
  assignments: {
    id: string;
    propertyId: string;
    bookingLineId: string;
    bookingId: string;
    roomId: string;
    stayDate: string;
    active: boolean;
  }[];
  roomBlocks: {
    id: string;
    propertyId: string;
    roomId: string;
    blockKind: "ooo" | "oos" | "hold";
    fromDate: string;
    toDate: string;
    reason: string;
    releasedAt: string | null;
  }[];
  folios: {
    id: string;
    propertyId: string;
    bookingId: string;
    payerType: "guest" | "agent";
    status: string;
    balance: number;
  }[];
  folioLines: {
    id: string;
    folioId: string;
    propertyId: string;
    description: string;
    net: number;
    scAmount: number;
    gstAmount: number;
    totalAmount: number;
    sourceType: string;
    sourceId: string;
    postedAt: string;
  }[];
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Load FO money/inventory rows from schema v2 into a plain snapshot for memory boot. */
export async function loadFrontOfficeSnapshot(
  db: Db,
): Promise<{ ok: true; data: FoHydrateSnapshot } | { ok: false; error: string }> {
  try {
    const propRows = await db.select().from(properties);
    const typeRows = await db.select().from(roomTypes);
    const roomRows = await db.select().from(rooms);
    const guestRows = await db.select().from(guests);
    const groupRows = await db.select().from(groups);
    const agentRows = await db.select().from(agents);
    const bookingRows = await db.select().from(bookings);
    const lineRows = await db.select().from(bookingLines);
    const assignRows = await db.select().from(roomAssignments);
    const blockRows = await db.select().from(roomBlocks);
    const folioRows = await db.select().from(folios);
    const chargeRows = await db.select().from(folioLines);

    const guestNameById = new Map(guestRows.map((g) => [g.id, g.fullName]));
    const agentNameById = new Map(agentRows.map((a) => [a.id, a.name]));
    const bookingIdByLine = new Map(lineRows.map((l) => [l.id, l.bookingId]));

    const activeRoomByLine = new Map<string, string>();
    for (const a of assignRows) {
      if (a.active) activeRoomByLine.set(a.bookingLineId, a.roomId);
    }

    const balanceByFolio = new Map<string, number>();
    for (const c of chargeRows) {
      const prev = balanceByFolio.get(c.folioId) ?? 0;
      balanceByFolio.set(c.folioId, Math.round((prev + num(c.totalAmount)) * 100) / 100);
    }

    const linesByBooking = new Map<string, FoHydrateSnapshot["bookings"][number]["lines"]>();
    for (const l of lineRows) {
      const arr = linesByBooking.get(l.bookingId) ?? [];
      arr.push({
        id: l.id,
        bookingId: l.bookingId,
        roomTypeId: l.roomTypeId,
        ratePlanId: l.ratePlanId,
        netAmount: l.netAmount != null ? num(l.netAmount) : null,
        mealPlan: l.mealPlan,
        roomId: activeRoomByLine.get(l.id) ?? null,
      });
      linesByBooking.set(l.bookingId, arr);
    }

    return {
      ok: true,
      data: {
        properties: propRows.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          scRate: num(p.scRate),
          gstRate: num(p.gstRate),
          gstEnabled: p.gstEnabled,
          currentBusinessDate: String(p.currentBusinessDate),
        })),
        roomTypes: typeRows.map((t) => ({
          id: t.id,
          propertyId: t.propertyId,
          code: t.code,
          name: t.name,
          baseOccupancy: t.baseOccupancy,
        })),
        rooms: roomRows.map((r) => ({
          id: r.id,
          propertyId: r.propertyId,
          roomTypeId: r.roomTypeId,
          number: r.number,
          floor: r.floor,
          hkStatus: r.hkStatus,
        })),
        guests: guestRows.map((g) => ({
          id: g.id,
          propertyId: g.propertyId,
          fullName: g.fullName,
          nationality: g.nationality,
          phone: g.phone,
          email: g.email,
          vip: g.vip,
          passportOrCid: g.passportOrCid,
        })),
        groups: groupRows.map((g) => ({
          id: g.id,
          propertyId: g.propertyId,
          name: g.name,
          agentId: g.agentId,
        })),
        bookings: bookingRows.map((b) => ({
          id: b.id,
          propertyId: b.propertyId,
          confirmationNo: b.confirmationNo,
          status: b.status,
          guestId: b.guestId,
          guestName: (b.guestId && guestNameById.get(b.guestId)) || "Guest",
          agentId: b.agentId ?? null,
          agencyName: (b.agentId && agentNameById.get(b.agentId)) || null,
          groupId: b.groupId,
          checkIn: String(b.checkIn),
          checkOut: String(b.checkOut),
          source: b.source,
          notes: b.notes,
          companionName: b.companionName,
          companionPassportOrCid: b.companionPassportOrCid,
          companionNationality: b.companionNationality,
          lines: linesByBooking.get(b.id) ?? [],
        })),
        assignments: assignRows.map((a) => ({
          id: a.id,
          propertyId: a.propertyId,
          bookingLineId: a.bookingLineId,
          bookingId: bookingIdByLine.get(a.bookingLineId) ?? "",
          roomId: a.roomId,
          stayDate: String(a.stayDate),
          active: a.active,
        })),
        roomBlocks: blockRows.map((b) => ({
          id: b.id,
          propertyId: b.propertyId,
          roomId: b.roomId,
          blockKind:
            b.blockKind === "oos" || b.blockKind === "hold" ? b.blockKind : "ooo",
          fromDate: String(b.fromDate),
          toDate: String(b.toDate),
          reason: b.reason,
          releasedAt: b.releasedAt ? new Date(b.releasedAt).toISOString() : null,
        })),
        folios: folioRows.map((f) => ({
          id: f.id,
          propertyId: f.propertyId,
          bookingId: f.bookingId,
          payerType: f.payerType === "agent" ? "agent" : "guest",
          status: f.status,
          balance: balanceByFolio.get(f.id) ?? 0,
        })),
        folioLines: chargeRows.map((c) => ({
          id: c.id,
          folioId: c.folioId,
          propertyId: c.propertyId,
          description: c.description,
          net: num(c.netAmount),
          scAmount: num(c.scAmount),
          gstAmount: num(c.gstAmount),
          totalAmount: num(c.totalAmount),
          sourceType: c.kind,
          sourceId: c.id,
          postedAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        })),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fo-persist] loadFrontOfficeSnapshot failed", { err: msg });
    return { ok: false, error: "FO_HYDRATE_FAILED" };
  }
}
