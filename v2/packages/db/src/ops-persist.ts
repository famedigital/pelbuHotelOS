/**
 * Persist Bhutanese ops-law writes (CFM advance, ADMS punches, tip pool, drawer).
 * SOURCE-MAP: REINVENT — schema v2; domain formulas stay in @hos-v2/domain.
 */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  attendancePunches,
  bankStatementLines,
  bankStatements,
  bookingLines,
  bookings,
  cashDrawerMovements,
  cashDrawerShifts,
  fleetVehicles,
  guests,
  procurementAdvances,
  procurementBillItems,
  partnerCalendar,
  procurementBills,
  properties,
  reconciliationMatches,
  roomAssignments,
  rooms,
  scTipPoolLines,
  scTipPoolRuns,
  staff,
  tourGuides,
} from "./schema.js";

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export type PersistedAdvance = {
  id: string;
  propertyId: string;
  amountBtn: number;
  spentBtn: number;
  changeReturnedBtn: number;
  status: "open" | "reconciled";
  purpose: string;
  shiftId: string | null;
};

function mapAdvance(row: typeof procurementAdvances.$inferSelect): PersistedAdvance {
  return {
    id: row.id,
    propertyId: row.propertyId,
    amountBtn: Number(row.amountBtn),
    spentBtn: Number(row.spentBtn),
    changeReturnedBtn: Number(row.changeReturnedBtn),
    status: row.status === "reconciled" ? "reconciled" : "open",
    purpose: row.purpose,
    shiftId: row.shiftId,
  };
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function ensureOpenDrawerShift(
  tx: Tx | Db,
  propertyId: string,
  openingFloatBtn: number,
): Promise<{ id: string; expectedBalanceBtn: number }> {
  const open = await tx
    .select()
    .from(cashDrawerShifts)
    .where(
      and(
        eq(cashDrawerShifts.propertyId, propertyId),
        eq(cashDrawerShifts.status, "open"),
      ),
    )
    .limit(1);
  const existing = open[0];
  if (existing) {
    return {
      id: existing.id,
      expectedBalanceBtn: Number(existing.expectedBalanceBtn),
    };
  }
  const id = crypto.randomUUID();
  await tx.insert(cashDrawerShifts).values({
    id,
    propertyId,
    openingFloatBtn: money(openingFloatBtn),
    expectedBalanceBtn: money(openingFloatBtn),
    status: "open",
  });
  return { id, expectedBalanceBtn: openingFloatBtn };
}

export async function getOpenTillBalance(
  db: Db,
  propertyId: string,
): Promise<{ tillBalanceBtn: number; shiftId: string | null }> {
  const open = await db
    .select()
    .from(cashDrawerShifts)
    .where(
      and(
        eq(cashDrawerShifts.propertyId, propertyId),
        eq(cashDrawerShifts.status, "open"),
      ),
    )
    .limit(1);
  const row = open[0];
  if (!row) {
    return { tillBalanceBtn: 0, shiftId: null };
  }
  return {
    tillBalanceBtn: Number(row.expectedBalanceBtn),
    shiftId: row.id,
  };
}

export async function resolveDefaultPropertyId(
  db: Db,
  preferredId?: string,
): Promise<string | null> {
  if (preferredId) {
    const rows = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, preferredId))
      .limit(1);
    if (rows[0]) return rows[0].id;
  }
  const envId = process.env.V2_DEFAULT_PROPERTY_ID?.trim();
  if (envId) {
    const rows = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, envId))
      .limit(1);
    if (rows[0]) return rows[0].id;
  }
  const first = await db.select({ id: properties.id }).from(properties).limit(1);
  return first[0]?.id ?? null;
}

export async function insertAttendancePunches(
  db: Db,
  rows: Array<{
    propertyId: string;
    deviceSn: string;
    employeeCode: string;
    punchedAt: Date;
    punchType: number;
    verifyMode: number;
    rawLine: string;
    lateMinutes: number;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  let inserted = 0;
  for (const row of rows) {
    try {
      await db
        .insert(attendancePunches)
        .values({
          propertyId: row.propertyId,
          deviceSn: row.deviceSn,
          employeeCode: row.employeeCode,
          punchedAt: row.punchedAt,
          punchType: row.punchType,
          verifyMode: row.verifyMode,
          rawLine: row.rawLine,
          lateMinutes: row.lateMinutes,
        })
        .onConflictDoNothing();
      inserted += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ops-persist] insertAttendancePunches row failed", {
        err: msg,
        employeeCode: row.employeeCode,
      });
    }
  }
  return inserted;
}

export async function listAttendancePunches(
  db: Db,
  propertyId: string,
  limit = 200,
): Promise<
  Array<{
    propertyId: string;
    deviceSn: string;
    employeeCode: string;
    punchedAtIso: string;
    lateMinutes: number;
    rawLine: string;
  }>
> {
  const rows = await db
    .select()
    .from(attendancePunches)
    .where(eq(attendancePunches.propertyId, propertyId))
    .orderBy(desc(attendancePunches.punchedAt))
    .limit(limit);
  return rows.map((r) => ({
    propertyId: r.propertyId,
    deviceSn: r.deviceSn,
    employeeCode: r.employeeCode,
    punchedAtIso: r.punchedAt.toISOString(),
    lateMinutes: r.lateMinutes,
    rawLine: r.rawLine,
  }));
}

export async function issueAdvancePersist(
  db: Db,
  input: {
    propertyId: string;
    amountBtn: number;
    tillBalanceBtn: number;
    purpose: string;
    idempotencyKey: string;
    issuedByStaffId?: string | null;
  },
): Promise<
  | { ok: true; advance: PersistedAdvance; tillAfterBtn: number; replay: boolean }
  | { ok: false; error: string }
> {
  const prop = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, input.propertyId))
    .limit(1);
  if (!prop[0]) return { ok: false, error: "PROPERTY_NOT_FOUND" };

  const existing = await db
    .select()
    .from(procurementAdvances)
    .where(
      and(
        eq(procurementAdvances.propertyId, input.propertyId),
        eq(procurementAdvances.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing[0]) {
    const adv = mapAdvance(existing[0]);
    return {
      ok: true,
      advance: adv,
      tillAfterBtn: Math.round((input.tillBalanceBtn - adv.amountBtn) * 100) / 100,
      replay: true,
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const shift = await ensureOpenDrawerShift(
        tx,
        input.propertyId,
        input.tillBalanceBtn,
      );
      const tillAfter =
        Math.round((shift.expectedBalanceBtn - input.amountBtn) * 100) / 100;
      if (tillAfter < 0) {
        return { ok: false as const, error: "INSUFFICIENT_TILL" };
      }

      const movementId = crypto.randomUUID();
      const advanceId = crypto.randomUUID();

      await tx.insert(cashDrawerMovements).values({
        id: movementId,
        propertyId: input.propertyId,
        shiftId: shift.id,
        kind: "procurement_advance",
        amountBtn: money(input.amountBtn),
        direction: "out",
        referenceType: "procurement_advance",
        referenceId: advanceId,
        note: input.purpose,
        actorStaffId: input.issuedByStaffId ?? null,
        idempotencyKey: input.idempotencyKey,
      });

      await tx.insert(procurementAdvances).values({
        id: advanceId,
        propertyId: input.propertyId,
        shiftId: shift.id,
        issuedByStaffId: input.issuedByStaffId ?? null,
        amountBtn: money(input.amountBtn),
        purpose: input.purpose,
        status: "open",
        drawerMovementOutId: movementId,
        idempotencyKey: input.idempotencyKey,
      });

      await tx
        .update(cashDrawerShifts)
        .set({
          expectedBalanceBtn: money(tillAfter),
          version: sql`${cashDrawerShifts.version} + 1`,
        })
        .where(eq(cashDrawerShifts.id, shift.id));

      return {
        ok: true as const,
        advance: {
          id: advanceId,
          propertyId: input.propertyId,
          amountBtn: input.amountBtn,
          spentBtn: 0,
          changeReturnedBtn: 0,
          status: "open" as const,
          purpose: input.purpose,
          shiftId: shift.id,
        },
        tillAfterBtn: tillAfter,
        replay: false,
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      const again = await db
        .select()
        .from(procurementAdvances)
        .where(
          and(
            eq(procurementAdvances.propertyId, input.propertyId),
            eq(procurementAdvances.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (again[0]) {
        const adv = mapAdvance(again[0]);
        return {
          ok: true,
          advance: adv,
          tillAfterBtn: Math.round((input.tillBalanceBtn - adv.amountBtn) * 100) / 100,
          replay: true,
        };
      }
    }
    console.error("[ops-persist] issueAdvancePersist failed", { err: msg });
    return { ok: false, error: "ADVANCE_PERSIST_FAILED" };
  }
}

export async function reconcileAdvancePersist(
  db: Db,
  input: {
    propertyId: string;
    advanceId: string;
    spentBtn: number;
    changeReturnedBtn: number;
    tillCreditBtn: number;
    idempotencyKey: string;
  },
): Promise<
  | { ok: true; advance: PersistedAdvance; tillCreditBtn: number; replay: boolean }
  | { ok: false; error: string }
> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from v2.procurement_advances where id = ${input.advanceId} and property_id = ${input.propertyId} for update`,
      );

      const selected = await tx
        .select()
        .from(procurementAdvances)
        .where(
          and(
            eq(procurementAdvances.id, input.advanceId),
            eq(procurementAdvances.propertyId, input.propertyId),
          ),
        )
        .limit(1);
      const row = selected[0];
      if (!row) return { ok: false as const, error: "ADVANCE_NOT_FOUND" };
      if (row.status === "reconciled") {
        return {
          ok: true as const,
          advance: mapAdvance(row),
          tillCreditBtn: Number(row.changeReturnedBtn),
          replay: true,
        };
      }

      let movementInId: string | null = row.drawerMovementInId;
      if (row.shiftId && input.tillCreditBtn > 0) {
        const prior = await tx
          .select()
          .from(cashDrawerMovements)
          .where(
            and(
              eq(cashDrawerMovements.propertyId, input.propertyId),
              eq(cashDrawerMovements.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1);
        if (prior[0]) {
          movementInId = prior[0].id;
        } else {
          movementInId = crypto.randomUUID();
          await tx.insert(cashDrawerMovements).values({
            id: movementInId,
            propertyId: input.propertyId,
            shiftId: row.shiftId,
            kind: "advance_change_return",
            amountBtn: money(input.tillCreditBtn),
            direction: "in",
            referenceType: "procurement_advance",
            referenceId: input.advanceId,
            note: "Change returned",
            idempotencyKey: input.idempotencyKey,
          });
          await tx
            .update(cashDrawerShifts)
            .set({
              expectedBalanceBtn: sql`(${cashDrawerShifts.expectedBalanceBtn})::numeric + ${money(input.tillCreditBtn)}::numeric`,
              version: sql`${cashDrawerShifts.version} + 1`,
            })
            .where(eq(cashDrawerShifts.id, row.shiftId));
        }
      }

      const updated = await tx
        .update(procurementAdvances)
        .set({
          status: "reconciled",
          spentBtn: money(input.spentBtn),
          changeReturnedBtn: money(input.changeReturnedBtn),
          reconciledAt: new Date(),
          drawerMovementInId: movementInId,
          version: sql`${procurementAdvances.version} + 1`,
        })
        .where(eq(procurementAdvances.id, input.advanceId))
        .returning();

      const next = updated[0];
      if (!next) return { ok: false as const, error: "ADVANCE_NOT_FOUND" };
      return {
        ok: true as const,
        advance: mapAdvance(next),
        tillCreditBtn: input.tillCreditBtn,
        replay: false,
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ops-persist] reconcileAdvancePersist failed", { err: msg });
    return { ok: false, error: "ADVANCE_RECONCILE_FAILED" };
  }
}

export async function listAdvances(
  db: Db,
  propertyId: string,
): Promise<PersistedAdvance[]> {
  const rows = await db
    .select()
    .from(procurementAdvances)
    .where(eq(procurementAdvances.propertyId, propertyId))
    .orderBy(desc(procurementAdvances.createdAt));
  return rows.map(mapAdvance);
}

export async function postCashBillPersist(
  db: Db,
  input: {
    propertyId: string;
    advanceId: string;
    billNo: string;
    grandTotalBtn: number;
    idempotencyKey: string;
    supplierName?: string;
    category?: string;
    items?: Array<{
      itemName: string;
      category: string;
      qty: number;
      unit: string;
      unitCostBtn: number;
      lineTotalBtn: number;
      stallNo?: string;
    }>;
  },
): Promise<{ ok: true; billId: string; replay: boolean } | { ok: false; error: string }> {
  const prior = await db
    .select()
    .from(procurementBills)
    .where(
      and(
        eq(procurementBills.propertyId, input.propertyId),
        eq(procurementBills.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (prior[0]) {
    return { ok: true, billId: prior[0].id, replay: true };
  }

  const advance = await db
    .select()
    .from(procurementAdvances)
    .where(
      and(
        eq(procurementAdvances.id, input.advanceId),
        eq(procurementAdvances.propertyId, input.propertyId),
      ),
    )
    .limit(1);
  if (!advance[0]) return { ok: false, error: "ADVANCE_NOT_FOUND" };

  const billId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(procurementBills).values({
        id: billId,
        propertyId: input.propertyId,
        advanceId: input.advanceId,
        billNo: input.billNo,
        billDate: today,
        supplierName: input.supplierName ?? "Cash market",
        category: input.category ?? "cfm",
        grandTotalBtn: money(input.grandTotalBtn),
        paymentMode: "cash",
        idempotencyKey: input.idempotencyKey,
      });
      if (input.items && input.items.length > 0) {
        await tx.insert(procurementBillItems).values(
          input.items.map((it) => ({
            propertyId: input.propertyId,
            billId,
            itemName: it.itemName,
            category: it.category,
            qty: it.qty.toFixed(3),
            unit: it.unit,
            unitCostBtn: money(it.unitCostBtn),
            lineTotalBtn: money(it.lineTotalBtn),
            stallNo: it.stallNo ?? null,
          })),
        );
      }
    });
    return { ok: true, billId, replay: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      const again = await db
        .select()
        .from(procurementBills)
        .where(
          and(
            eq(procurementBills.propertyId, input.propertyId),
            eq(procurementBills.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (again[0]) return { ok: true, billId: again[0].id, replay: true };
    }
    console.error("[ops-persist] postCashBillPersist failed", { err: msg });
    return { ok: false, error: "BILL_PERSIST_FAILED" };
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asOptionalUuid(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return UUID_RE.test(value.trim()) ? value.trim() : null;
}

export type PartnerCalendarPersistCell = {
  stayDate: string;
  roomId: string;
  state: "free" | "held" | "occupied";
  ownerAgentId: string | null;
  guestName: string | null;
  bookingRef: string | null;
};

/** Replace partner calendar audit rows for the date span covered by `cells`. */
export async function upsertPartnerCalendarCells(
  db: Db,
  input: {
    propertyId: string;
    cells: PartnerCalendarPersistCell[];
  },
): Promise<{ ok: true; rowCount: number } | { ok: false; error: string }> {
  const prop = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, input.propertyId))
    .limit(1);
  if (!prop[0]) return { ok: false, error: "PROPERTY_NOT_FOUND" };
  if (input.cells.length === 0) {
    return { ok: true, rowCount: 0 };
  }

  const dates = input.cells.map((c) => c.stayDate).sort();
  const minDate = dates[0]!;
  const maxDate = dates[dates.length - 1]!;

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(partnerCalendar)
        .where(
          and(
            eq(partnerCalendar.propertyId, input.propertyId),
            gte(partnerCalendar.stayDate, minDate),
            lte(partnerCalendar.stayDate, maxDate),
          ),
        );
      await tx.insert(partnerCalendar).values(
        input.cells.map((c) => ({
          propertyId: input.propertyId,
          stayDate: c.stayDate,
          roomId: asOptionalUuid(c.roomId),
          state: c.state,
          ownerAgentId: asOptionalUuid(c.ownerAgentId),
          guestName: c.guestName,
          bookingRef: c.bookingRef,
        })),
      );
    });
    return { ok: true, rowCount: input.cells.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ops-persist] upsertPartnerCalendarCells failed", { err: msg });
    return { ok: false, error: "PARTNER_CALENDAR_PERSIST_FAILED" };
  }
}

export type ImmigrationManifestRow = {
  confirmationNo: string;
  guestName: string;
  passportOrCid: string | null;
  visaStamp: string | null;
  nationality: string | null;
  checkIn: string;
  checkOut: string;
  roomNumber: string | null;
  guideLicense: string | null;
  vehiclePlate: string | null;
  status: string;
};

/** In-house / arriving foreign-guest rows for RBP / Immigration CSV. */
export async function listImmigrationManifest(
  db: Db,
  propertyId: string,
  asOfDate: string,
): Promise<ImmigrationManifestRow[]> {
  const rows = await db
    .select({
      confirmationNo: bookings.confirmationNo,
      guestName: guests.fullName,
      passportOrCid: guests.passportOrCid,
      visaStamp: guests.visaStamp,
      nationality: guests.nationality,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      status: bookings.status,
      roomNumber: rooms.number,
    })
    .from(bookings)
    .leftJoin(guests, eq(bookings.guestId, guests.id))
    .leftJoin(
      bookingLines,
      and(
        eq(bookingLines.bookingId, bookings.id),
        eq(bookingLines.propertyId, propertyId),
      ),
    )
    .leftJoin(
      roomAssignments,
      and(
        eq(roomAssignments.bookingLineId, bookingLines.id),
        eq(roomAssignments.propertyId, propertyId),
        eq(roomAssignments.active, true),
        eq(roomAssignments.stayDate, asOfDate),
      ),
    )
    .leftJoin(rooms, eq(roomAssignments.roomId, rooms.id))
    .where(
      and(
        eq(bookings.propertyId, propertyId),
        sql`${bookings.checkIn} <= ${asOfDate}`,
        sql`${bookings.checkOut} > ${asOfDate}`,
        sql`${bookings.status} in ('confirmed', 'checked_in')`,
      ),
    );

  const guides = await db
    .select()
    .from(tourGuides)
    .where(eq(tourGuides.propertyId, propertyId))
    .limit(1);
  const vehicles = await db
    .select()
    .from(fleetVehicles)
    .where(eq(fleetVehicles.propertyId, propertyId))
    .limit(1);
  const guideLicense = guides[0]?.tcrLicenseNo ?? null;
  const vehiclePlate = vehicles[0]?.plate ?? null;

  return rows.map((r) => ({
    confirmationNo: r.confirmationNo,
    guestName: r.guestName ?? "Unknown",
    passportOrCid: r.passportOrCid,
    visaStamp: r.visaStamp,
    nationality: r.nationality,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    roomNumber: r.roomNumber,
    guideLicense,
    vehiclePlate,
    status: r.status,
  }));
}

export async function importBankStatementPersist(
  db: Db,
  input: {
    propertyId: string;
    bankCode: string;
    accountLabel: string;
    statementDate: string;
    sourceFilename?: string;
    closingBalanceBtn?: number;
    lines: Array<{
      txnDate: string;
      description: string;
      amountBtn: number;
      direction: "in" | "out";
      debitBtn?: number;
      creditBtn?: number;
      balanceBtn?: number;
      externalRef?: string;
      fingerprint?: string;
    }>;
  },
): Promise<{ ok: true; statementId: string } | { ok: false; error: string }> {
  const prop = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, input.propertyId))
    .limit(1);
  if (!prop[0]) return { ok: false, error: "PROPERTY_NOT_FOUND" };

  const statementId = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(bankStatements).values({
        id: statementId,
        propertyId: input.propertyId,
        bankCode: input.bankCode,
        accountLabel: input.accountLabel,
        statementDate: input.statementDate,
        closingBalanceBtn:
          input.closingBalanceBtn != null ? money(input.closingBalanceBtn) : null,
        sourceFilename: input.sourceFilename ?? null,
        status: "imported",
      });
      if (input.lines.length > 0) {
        await tx.insert(bankStatementLines).values(
          input.lines.map((l) => {
            const debit =
              l.debitBtn ?? (l.direction === "out" ? l.amountBtn : 0);
            const credit =
              l.creditBtn ?? (l.direction === "in" ? l.amountBtn : 0);
            return {
              propertyId: input.propertyId,
              statementId,
              txnDate: l.txnDate,
              description: l.description,
              amountBtn: money(l.amountBtn),
              direction: l.direction,
              debitBtn: money(debit),
              creditBtn: money(credit),
              balanceBtn: l.balanceBtn != null ? money(l.balanceBtn) : null,
              externalRef: l.externalRef ?? null,
              fingerprint: l.fingerprint ?? null,
              status: "open",
            };
          }),
        );
      }
    });
    return { ok: true, statementId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ops-persist] importBankStatementPersist failed", { err: msg });
    return { ok: false, error: "BANK_IMPORT_FAILED" };
  }
}

/** Persist a bank line match (folio payment, advance, journal, etc.). */
export async function matchBankStatementLinePersist(
  db: Db,
  input: {
    propertyId: string;
    statementLineId: string;
    matchKind: string;
    matchEntityId: string;
    amountBtn: number;
    matchedByStaffId?: string;
  },
): Promise<
  | { ok: true; matchId: string; replay: boolean }
  | { ok: false; error: string }
> {
  const line = await db
    .select()
    .from(bankStatementLines)
    .where(
      and(
        eq(bankStatementLines.id, input.statementLineId),
        eq(bankStatementLines.propertyId, input.propertyId),
      ),
    )
    .limit(1);
  if (!line[0]) return { ok: false, error: "STATEMENT_LINE_NOT_FOUND" };

  if (line[0].status === "matched") {
    const prior = await db
      .select()
      .from(reconciliationMatches)
      .where(
        and(
          eq(reconciliationMatches.statementLineId, input.statementLineId),
          eq(reconciliationMatches.propertyId, input.propertyId),
        ),
      )
      .limit(1);
    if (prior[0]) {
      return { ok: true, matchId: prior[0].id, replay: true };
    }
  }

  const matchId = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(reconciliationMatches).values({
        id: matchId,
        propertyId: input.propertyId,
        statementLineId: input.statementLineId,
        matchKind: input.matchKind,
        matchEntityId: input.matchEntityId,
        amountBtn: money(input.amountBtn),
        matchedByStaffId: input.matchedByStaffId ?? null,
      });
      await tx
        .update(bankStatementLines)
        .set({ status: "matched" })
        .where(eq(bankStatementLines.id, input.statementLineId));
    });
    return { ok: true, matchId, replay: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ops-persist] matchBankStatementLinePersist failed", {
      err: msg,
    });
    return { ok: false, error: "BANK_MATCH_FAILED" };
  }
}

export async function runScTipPoolPersist(
  db: Db,
  input: {
    propertyId: string;
    periodYm: string;
    poolBtn: number;
    totalPointDays: number;
    lines: Array<{
      staffId: string;
      tipPoints: number;
      daysWorked: number;
      pointDays: number;
      shareBtn: number;
    }>;
  },
): Promise<
  | { ok: true; runId: string; replay: boolean }
  | { ok: false; error: string; missingStaffIds?: string[] }
> {
  const existing = await db
    .select()
    .from(scTipPoolRuns)
    .where(
      and(
        eq(scTipPoolRuns.propertyId, input.propertyId),
        eq(scTipPoolRuns.periodYm, input.periodYm),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true, runId: existing[0].id, replay: true };
  }

  const staffIds = [...new Set(input.lines.map((l) => l.staffId))];
  if (staffIds.length > 0) {
    const found = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.propertyId, input.propertyId), inArray(staff.id, staffIds)));
    const foundSet = new Set(found.map((f) => f.id));
    const missingConfirmed = staffIds.filter((id) => !foundSet.has(id));
    if (missingConfirmed.length > 0) {
      return {
        ok: false,
        error: "STAFF_NOT_FOUND",
        missingStaffIds: missingConfirmed,
      };
    }
  }

  const runId = crypto.randomUUID();
  const [yearStr, monthStr] = input.periodYm.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(scTipPoolRuns).values({
        id: runId,
        propertyId: input.propertyId,
        periodYm: input.periodYm,
        year: Number.isFinite(year) ? year : null,
        month: Number.isFinite(month) ? month : null,
        poolBtn: money(input.poolBtn),
        totalPointDays: input.totalPointDays.toFixed(4),
        status: "draft",
      });
      if (input.lines.length > 0) {
        await tx.insert(scTipPoolLines).values(
          input.lines.map((l) => ({
            propertyId: input.propertyId,
            runId,
            staffId: l.staffId,
            tipPoints: l.tipPoints.toFixed(2),
            daysWorked: l.daysWorked.toFixed(2),
            pointDays: l.pointDays.toFixed(4),
            shareBtn: money(l.shareBtn),
          })),
        );
      }
    });
    return { ok: true, runId, replay: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      const again = await db
        .select()
        .from(scTipPoolRuns)
        .where(
          and(
            eq(scTipPoolRuns.propertyId, input.propertyId),
            eq(scTipPoolRuns.periodYm, input.periodYm),
          ),
        )
        .limit(1);
      if (again[0]) return { ok: true, runId: again[0].id, replay: true };
    }
    console.error("[ops-persist] runScTipPoolPersist failed", { err: msg });
    return { ok: false, error: "TIP_POOL_PERSIST_FAILED" };
  }
}
