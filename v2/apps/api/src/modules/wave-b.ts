import {
  assertPersonalFolioCleared,
  permission,
  formatConfirmationNo,
  hotelDocPrefix,
  nightsBetween,
} from "@hos-v2/domain";
import {
  advanceBusinessDatePersist,
  assignRoomsPersist,
  blockRoomPersist,
  changeBookingDatesPersist,
  createReservationPersist,
  ensureAgencyFolioPersist,
  getDb,
  releaseRoomBlockPersist,
  updateBookingGuestRosterPersist,
  updateBookingNotesPersist,
  updateBookingStatusPersist,
  upsertGuestPersist,
} from "@hos-v2/db";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
} from "../platform/command.js";
import { store } from "../platform/memory-store.js";
import { commandHandlers, registerCommand } from "./registry.js";

registerCommand("reservations.createReservation", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      guestName: z.string().min(1),
      guestId: z.string().uuid().optional(),
      checkIn: z.string(),
      checkOut: z.string(),
      roomTypeId: z.string().uuid(),
      ratePlanId: z.string().uuid().optional(),
      mealPlan: z.enum(["EP", "CP", "MAP", "AP"]).default("EP"),
      groupId: z.string().uuid().optional(),
      agentId: z.string().uuid().optional(),
      /** Tour operator label for partner portal / hydrate (e.g. Yangphel Adventure Travel). */
      agencyName: z.string().min(1).max(120).optional(),
      source: z.enum(["desk", "agent_portal", "web", "ota", "channel"]).default("desk"),
      confirm: z.boolean().default(true),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);

  const denied =
    assertPermission(ctx.actor, permission("reservations", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights < 1) {
    return { ok: false, error: "checkOut must be after checkIn", code: "VALIDATION" };
  }

  const typeOk = store.roomTypes.some(
    (t) => t.id === input.roomTypeId && t.propertyId === input.propertyId,
  );
  if (!typeOk) return { ok: false, error: "Unknown room type", code: "NOT_FOUND" };

  const prop = store.ensureDemoProperty(input.propertyId);
  let guestId = input.guestId ?? null;
  if (!guestId) {
    const g = {
      id: crypto.randomUUID(),
      propertyId: input.propertyId,
      fullName: input.guestName,
      nationality: null,
      phone: null,
      email: null,
      vip: false,
    };
    store.guests.push(g);
    guestId = g.id;
  }

  let netAmount: number | null = null;
  if (input.ratePlanId) {
    const cell = store.rates.find(
      (r) =>
        r.propertyId === input.propertyId &&
        r.ratePlanId === input.ratePlanId &&
        r.roomTypeId === input.roomTypeId &&
        r.stayDate === input.checkIn,
    );
    netAmount = cell?.netAmount ?? null;
  }

  const bookingId = crypto.randomUUID();
  const lineId = crypto.randomUUID();
  const seq = store.nextBookingSeq(input.propertyId);
  const confirmationNo = formatConfirmationNo(hotelDocPrefix(prop.name), seq);
  const status = input.confirm ? "confirmed" : "held";

  const booking = {
    id: bookingId,
    propertyId: input.propertyId,
    confirmationNo,
    status,
    guestId,
    guestName: input.guestName,
    groupId: input.groupId ?? null,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    source: input.source,
    agencyName: input.agencyName?.trim() || null,
    lines: [
      {
        id: lineId,
        bookingId,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId ?? null,
        netAmount,
        mealPlan: input.mealPlan,
        roomId: null,
      },
    ],
  };
  store.bookings.push(booking);

  const folioId = crypto.randomUUID();
  store.folios.push({
    id: folioId,
    propertyId: input.propertyId,
    bookingId,
    payerType: "guest",
    status: "open",
    balance: 0,
  });

  let agencyFolioId: string | undefined;
  // Tour parties + agent-source FITs get a master (agency) folio for room+meal.
  if (input.agentId || input.groupId || input.source === "agent_portal") {
    agencyFolioId = crypto.randomUUID();
    store.folios.push({
      id: agencyFolioId,
      propertyId: input.propertyId,
      bookingId,
      payerType: "agent",
      status: "open",
      balance: 0,
    });
  }

  const db = getDb();
  if (db) {
    const rt = store.roomTypes.find((t) => t.id === input.roomTypeId);
    const persisted = await createReservationPersist(db, {
      propertyId: input.propertyId,
      bookingId,
      lineId,
      folioId,
      agencyFolioId,
      guestId,
      guestName: input.guestName,
      confirmationNo,
      status,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId ?? null,
      mealPlan: input.mealPlan,
      source: input.source,
      groupId: input.groupId ?? null,
      netAmount,
      roomTypeCode: rt?.code,
      roomTypeName: rt?.name,
    });
    if (!persisted.ok) {
      store.bookings = store.bookings.filter((b) => b.id !== bookingId);
      store.folios = store.folios.filter((f) => f.bookingId !== bookingId);
      store.guests = store.guests.filter((g) => g.id !== guestId);
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }

  ctx.audit({
    action: "reservations.createReservation",
    entityType: "booking",
    entityId: bookingId,
    after: { confirmationNo, guestName: input.guestName, nights, status, folioId, agencyFolioId },
  });
  ctx.emit({
    type: status === "confirmed" ? "booking.confirmed" : "booking.created",
    aggregateType: "booking",
    aggregateId: bookingId,
    payload: {
      confirmationNo,
      lineId,
      roomTypeId: input.roomTypeId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      source: input.source,
      folioId,
      agencyFolioId,
    },
  });

  return {
    ok: true,
    data: {
      bookingId,
      lineId,
      confirmationNo,
      status,
      nights,
      folioId,
      agencyFolioId,
      guestId,
    },
  };
});

/** Ensure a master (agent) folio exists for tour / agent stays — idempotent. */
registerCommand("reservations.ensureAgencyFolio", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("reservations", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found", code: "NOT_FOUND" };

  const existing = store.folios.find(
    (f) => f.bookingId === booking.id && f.payerType === "agent",
  );
  if (existing) {
    return { ok: true, data: { agencyFolioId: existing.id, created: false } };
  }

  const agencyFolioId = crypto.randomUUID();
  store.folios.push({
    id: agencyFolioId,
    propertyId: input.propertyId,
    bookingId: booking.id,
    payerType: "agent",
    status: "open",
    balance: 0,
  });

  const db = getDb();
  if (db) {
    const persisted = await ensureAgencyFolioPersist(db, {
      propertyId: input.propertyId,
      bookingId: booking.id,
      agencyFolioId,
    });
    if (!persisted.ok) {
      store.folios = store.folios.filter((f) => f.id !== agencyFolioId);
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }

  ctx.audit({
    action: "reservations.ensureAgencyFolio",
    entityType: "folio",
    entityId: agencyFolioId,
    after: { bookingId: booking.id, payerType: "agent" },
  });
  return { ok: true, data: { agencyFolioId, created: true } };
});

registerCommand("stayview.assignRooms", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingLineId: z.string().uuid(),
      roomId: z.string().uuid(),
      /** assign = same type; upgrade = cross-type keep rate; move = same as assign + reason */
      mode: z.enum(["assign", "upgrade", "move"]).default("assign"),
      reason: z.string().max(200).optional(),
      /** Manager PIN attested by desk for dirty-room override (audit only). */
      dirtyOverridePin: z.string().min(4).max(8).optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("stayview", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const booking = store.bookings.find((b) =>
    b.lines.some((l) => l.id === input.bookingLineId && b.propertyId === input.propertyId),
  );
  const line = booking?.lines.find((l) => l.id === input.bookingLineId);
  if (!booking || !line) return { ok: false, error: "Booking line not found", code: "NOT_FOUND" };

  const room = store.rooms.find(
    (r) => r.id === input.roomId && r.propertyId === input.propertyId,
  );
  if (!room) return { ok: false, error: "Room not found", code: "NOT_FOUND" };
  if (input.mode !== "upgrade" && room.roomTypeId !== line.roomTypeId) {
    return { ok: false, error: "Room type mismatch (use upgrade to change type)", code: "VALIDATION" };
  }

  const activeBlock = store.roomBlocks.find(
    (b) =>
      b.propertyId === input.propertyId &&
      b.roomId === input.roomId &&
      b.releasedAt == null &&
      b.fromDate < booking.checkOut &&
      b.toDate > booking.checkIn,
  );
  if (activeBlock) {
    return {
      ok: false,
      error: `Room ${room.number} blocked (${activeBlock.blockKind}) until ${activeBlock.toDate}`,
      code: "BLOCKED",
    };
  }

  const dates = store.datesBetween(booking.checkIn, booking.checkOut);
  for (const stayDate of dates) {
    const clash = store.assignments.find(
      (a) =>
        a.active &&
        a.roomId === input.roomId &&
        a.stayDate === stayDate &&
        a.bookingLineId !== input.bookingLineId,
    );
    if (clash) {
      return {
        ok: false,
        error: `Room ${room.number} already assigned on ${stayDate}`,
        code: "CONFLICT",
      };
    }
  }

  for (const a of store.assignments) {
    if (a.bookingLineId === input.bookingLineId && a.active) a.active = false;
  }

  const assignmentIds: string[] = [];
  for (const stayDate of dates) {
    const id = crypto.randomUUID();
    assignmentIds.push(id);
    store.assignments.push({
      id,
      propertyId: input.propertyId,
      bookingLineId: input.bookingLineId,
      bookingId: booking.id,
      roomId: input.roomId,
      stayDate,
      active: true,
    });
  }
  line.roomId = input.roomId;
  if (input.mode === "upgrade") {
    /* Keep commercial rate; only inventory type changes. */
    line.roomTypeId = room.roomTypeId;
  }

  const dbAssign = getDb();
  if (dbAssign) {
    const persisted = await assignRoomsPersist(dbAssign, {
      propertyId: input.propertyId,
      bookingLineId: input.bookingLineId,
      roomId: input.roomId,
      stayDates: dates,
      assignmentIds,
    });
    if (!persisted.ok) {
      for (const id of assignmentIds) {
        store.assignments = store.assignments.filter((a) => a.id !== id);
      }
      line.roomId = null;
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }

  ctx.audit({
    action:
      input.mode === "upgrade"
        ? "stayview.upgradeRoom"
        : input.mode === "move"
          ? "stayview.moveRoom"
          : "stayview.assignRooms",
    entityType: "booking_line",
    entityId: input.bookingLineId,
    after: {
      roomId: input.roomId,
      dates,
      mode: input.mode,
      reason: input.reason ?? null,
      dirtyOverride: Boolean(input.dirtyOverridePin),
      nightlyNetKept: line.netAmount,
    },
  });
  ctx.emit({
    type: "room.assigned",
    aggregateType: "booking_line",
    aggregateId: input.bookingLineId,
    payload: {
      roomId: input.roomId,
      stayDates: dates,
      roomNumber: room.number,
      mode: input.mode,
      dirtyOverride: Boolean(input.dirtyOverridePin),
    },
  });
  return {
    ok: true,
    data: { assigned: dates.length, roomNumber: room.number, mode: input.mode },
  };
});

registerCommand("stayview.changeDates", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("stayview", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found", code: "NOT_FOUND" };
  if (input.checkOut <= booking.checkIn) {
    return { ok: false, error: "checkOut must be after checkIn", code: "VALIDATION" };
  }
  if (["cancelled", "checked_out", "no_show"].includes(booking.status)) {
    return { ok: false, error: `Cannot change dates from ${booking.status}`, code: "STATE" };
  }

  const prevOut = booking.checkOut;
  const extending = input.checkOut > prevOut;
  const line = booking.lines[0];
  if (line?.roomId && extending) {
    for (const stayDate of store.datesBetween(prevOut, input.checkOut)) {
      const clash = store.assignments.find(
        (a) =>
          a.active &&
          a.roomId === line.roomId &&
          a.stayDate === stayDate &&
          a.bookingLineId !== line.id,
      );
      if (clash) {
        return {
          ok: false,
          error: `Room conflict on ${stayDate}`,
          code: "CONFLICT",
        };
      }
      const block = store.roomBlocks.find(
        (b) =>
          b.releasedAt == null &&
          b.roomId === line.roomId &&
          b.fromDate <= stayDate &&
          stayDate < b.toDate,
      );
      if (block) {
        return { ok: false, error: `Room blocked on ${stayDate}`, code: "BLOCKED" };
      }
    }
  }

  booking.checkOut = input.checkOut;
  const addedNights = extending
    ? store.datesBetween(prevOut, input.checkOut)
    : [];
  const removedNights = !extending
    ? store.datesBetween(input.checkOut, prevOut)
    : [];

  if (line) {
    for (const a of store.assignments) {
      if (a.bookingLineId !== line.id || !a.active) continue;
      if (a.stayDate >= input.checkOut) a.active = false;
    }
    if (line.roomId && extending) {
      for (const stayDate of addedNights) {
        store.assignments.push({
          id: crypto.randomUUID(),
          propertyId: input.propertyId,
          bookingLineId: line.id,
          bookingId: booking.id,
          roomId: line.roomId,
          stayDate,
          active: true,
        });
      }
    }
  }

  const dbDates = getDb();
  if (dbDates) {
    const persisted = await changeBookingDatesPersist(dbDates, {
      propertyId: input.propertyId,
      bookingId: booking.id,
      checkOut: input.checkOut,
      bookingLineId: line?.id,
      roomId: line?.roomId ?? null,
      addedNights,
      removedNights,
    });
    if (!persisted.ok) {
      booking.checkOut = prevOut;
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }

  ctx.audit({
    action: "stayview.changeDates",
    entityType: "booking",
    entityId: booking.id,
    after: {
      checkOut: input.checkOut,
      prevOut,
      addedNights,
      removedNights,
    },
  });
  ctx.emit({
    type: "booking.modified",
    aggregateType: "booking",
    aggregateId: booking.id,
    payload: { checkOut: input.checkOut, addedNights, removedNights },
  });
  return {
    ok: true,
    data: {
      checkOut: input.checkOut,
      addedNights,
      removedNights,
      nightlyNet: line?.netAmount ?? 0,
      mealPlan: line?.mealPlan ?? "EP",
    },
  };
});

registerCommand("stayview.blockRoom", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      roomId: z.string().uuid(),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      blockKind: z.enum(["ooo", "oos", "hold"]).default("ooo"),
      reason: z.string().min(1).max(200),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("stayview", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  if (input.toDate <= input.fromDate) {
    return { ok: false, error: "toDate must be after fromDate", code: "VALIDATION" };
  }
  const room = store.rooms.find(
    (r) => r.id === input.roomId && r.propertyId === input.propertyId,
  );
  if (!room) return { ok: false, error: "Room not found", code: "NOT_FOUND" };

  const overlapAssign = store.assignments.find(
    (a) =>
      a.active &&
      a.roomId === input.roomId &&
      a.stayDate >= input.fromDate &&
      a.stayDate < input.toDate,
  );
  if (overlapAssign) {
    return {
      ok: false,
      error: "Cannot block — active assignment overlaps window",
      code: "CONFLICT",
    };
  }

  const block = {
    id: crypto.randomUUID(),
    propertyId: input.propertyId,
    roomId: input.roomId,
    blockKind: input.blockKind,
    fromDate: input.fromDate,
    toDate: input.toDate,
    reason: input.reason,
    releasedAt: null as string | null,
  };
  const dbBlock = getDb();
  if (dbBlock) {
    const persisted = await blockRoomPersist(dbBlock, {
      id: block.id,
      propertyId: input.propertyId,
      roomId: input.roomId,
      blockKind: input.blockKind,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason,
    });
    if (!persisted.ok) {
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }
  store.roomBlocks.push(block);
  if (input.blockKind === "ooo") {
    room.hkStatus = "ooo";
  }
  ctx.audit({
    action: "stayview.blockRoom",
    entityType: "room",
    entityId: input.roomId,
    after: block,
  });
  ctx.emit({
    type: "room.blocked",
    aggregateType: "room",
    aggregateId: input.roomId,
    payload: block,
  });
  return { ok: true, data: block };
});

registerCommand("stayview.releaseRoomBlock", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      blockId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("stayview", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const block = store.roomBlocks.find(
    (b) => b.id === input.blockId && b.propertyId === input.propertyId,
  );
  if (!block) return { ok: false, error: "Block not found", code: "NOT_FOUND" };
  if (block.releasedAt) {
    return { ok: true, data: block };
  }
  const dbRelease = getDb();
  if (dbRelease) {
    const persisted = await releaseRoomBlockPersist(dbRelease, {
      propertyId: input.propertyId,
      blockId: input.blockId,
    });
    if (!persisted.ok) {
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }
  block.releasedAt = new Date().toISOString();
  const room = store.rooms.find((r) => r.id === block.roomId);
  if (room && room.hkStatus === "ooo") {
    room.hkStatus = "dirty";
  }
  ctx.audit({
    action: "stayview.releaseRoomBlock",
    entityType: "room_block",
    entityId: block.id,
    after: block,
  });
  ctx.emit({
    type: "room.unblocked",
    aggregateType: "room",
    aggregateId: block.roomId,
    payload: { blockId: block.id },
  });
  return { ok: true, data: block };
});

registerCommand("reservations.checkIn", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      /** Desk-attested manager PIN — clears dirty HK so CI can proceed. */
      dirtyOverridePin: z.string().min(4).max(8).optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("desk", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found", code: "NOT_FOUND" };
  if (!["confirmed", "held"].includes(booking.status)) {
    return { ok: false, error: `Cannot check in from ${booking.status}`, code: "STATE" };
  }
  const unassigned = booking.lines.filter((l) => !l.roomId);
  if (unassigned.length) {
    return {
      ok: false,
      error: "Assign rooms before check-in",
      code: "UNASSIGNED",
    };
  }
  const dirtyRooms: string[] = [];
  for (const line of booking.lines) {
    const room = store.rooms.find((r) => r.id === line.roomId);
    if (room && room.hkStatus === "dirty") {
      dirtyRooms.push(room.number);
      if (input.dirtyOverridePin) {
        room.hkStatus = "inspected";
      }
    }
  }
  if (dirtyRooms.length > 0 && !input.dirtyOverridePin) {
    return {
      ok: false,
      error: `Check-in disabled: room ${dirtyRooms.join(", ")} is dirty`,
      code: "DIRTY",
    };
  }

  booking.status = "checked_in";
  const dbCi = getDb();
  if (dbCi) {
    const persisted = await updateBookingStatusPersist(dbCi, {
      propertyId: input.propertyId,
      bookingId: booking.id,
      status: "checked_in",
    });
    if (!persisted.ok) {
      booking.status = "confirmed";
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }
  ctx.audit({
    action: "reservations.checkIn",
    entityType: "booking",
    entityId: booking.id,
    after: dirtyRooms.length
      ? { dirtyOverride: true, dirtyRooms }
      : { status: "checked_in" },
  });
  ctx.emit({
    type: "stay.checked_in",
    aggregateType: "booking",
    aggregateId: booking.id,
    payload: {
      confirmationNo: booking.confirmationNo,
      dirtyOverride: dirtyRooms.length > 0,
    },
  });
  return { ok: true, data: { bookingId: booking.id, status: "checked_in" } };
});

/** Undo check-in — restores confirmed; voids package room/meal lines (append-only reversals). */
registerCommand("reservations.revertCheckIn", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("desk", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found", code: "NOT_FOUND" };
  if (booking.status !== "checked_in") {
    if (booking.status === "confirmed") {
      return { ok: true, data: { bookingId: booking.id, status: "confirmed", idempotent: true } };
    }
    return {
      ok: false,
      error: `Cannot revert check-in from ${booking.status}`,
      code: "STATE",
    };
  }

  const voidFn = commandHandlers.get("finance.voidLineWithReversal");
  const isPackageDesc = (desc: string) =>
    /^Room ·/i.test(desc) || /meal plan/i.test(desc) || /extra bed/i.test(desc);
  const folios = store.folios.filter((f) => f.bookingId === booking.id);
  let packageReversals = 0;
  if (voidFn) {
    for (const folio of folios) {
      const lines = store.folioLines.filter(
        (l) =>
          l.folioId === folio.id &&
          l.sourceType !== "payment" &&
          l.sourceType !== "reversal" &&
          isPackageDesc(l.description),
      );
      for (const line of lines) {
        const already = store.folioLines.find(
          (l) => l.sourceType === "reversal" && l.sourceId === line.id,
        );
        if (already) continue;
        const voided = await voidFn(
          {
            propertyId: input.propertyId,
            folioId: folio.id,
            lineId: line.id,
            reason: "Revert check-in · package reversal",
            idempotencyKey: crypto.randomUUID(),
          },
          ctx,
        );
        if (!voided.ok) return voided;
        packageReversals += 1;
      }
    }
  }

  booking.status = "confirmed";
  const db = getDb();
  if (db) {
    const persisted = await updateBookingStatusPersist(db, {
      propertyId: input.propertyId,
      bookingId: booking.id,
      status: "confirmed",
    });
    if (!persisted.ok) {
      booking.status = "checked_in";
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }
  ctx.audit({
    action: "reservations.revertCheckIn",
    entityType: "booking",
    entityId: booking.id,
    after: { packageReversals },
  });
  ctx.emit({
    type: "stay.check_in_reverted",
    aggregateType: "booking",
    aggregateId: booking.id,
    payload: { confirmationNo: booking.confirmationNo, packageReversals },
  });
  return {
    ok: true,
    data: { bookingId: booking.id, status: "confirmed", packageReversals },
  };
});

registerCommand("reservations.updateNotes", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      notes: z.string().max(2000),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("stayview", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found", code: "NOT_FOUND" };
  const notes = input.notes.trim() || null;
  booking.notes = notes;
  const db = getDb();
  if (db) {
    const persisted = await updateBookingNotesPersist(db, {
      propertyId: input.propertyId,
      bookingId: booking.id,
      notes,
    });
    if (!persisted.ok) {
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }
  ctx.audit({
    action: "reservations.updateNotes",
    entityType: "booking",
    entityId: booking.id,
  });
  return { ok: true, data: { bookingId: booking.id, notes: booking.notes } };
});

registerCommand("reservations.checkOut", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("desk", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found", code: "NOT_FOUND" };
  if (booking.status !== "checked_in") {
    return { ok: false, error: `Cannot check out from ${booking.status}`, code: "STATE" };
  }

  const folios = store.folios
    .filter((f) => f.bookingId === booking.id)
    .map((f) => ({ payerType: f.payerType, balanceBtn: f.balance }));
  const gate = assertPersonalFolioCleared(folios);
  if (!gate.ok) {
    return {
      ok: false,
      error: `Personal folio Nu ${gate.personalBalanceBtn} — settle before checkout (gate Nu 0.50)`,
      code: "BALANCE",
      data: { personalBalanceBtn: gate.personalBalanceBtn },
    };
  }

  booking.status = "checked_out";
  for (const line of booking.lines) {
    if (line.roomId) {
      const room = store.rooms.find((r) => r.id === line.roomId);
      if (room) room.hkStatus = "dirty";
    }
  }
  for (const a of store.assignments) {
    if (a.bookingId === booking.id) a.active = false;
  }

  const dbCo = getDb();
  if (dbCo) {
    const persisted = await updateBookingStatusPersist(dbCo, {
      propertyId: input.propertyId,
      bookingId: booking.id,
      status: "checked_out",
    });
    if (!persisted.ok) {
      booking.status = "checked_in";
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }

  ctx.audit({
    action: "reservations.checkOut",
    entityType: "booking",
    entityId: booking.id,
  });
  ctx.emit({
    type: "stay.checked_out",
    aggregateType: "booking",
    aggregateId: booking.id,
    payload: {},
  });
  return { ok: true, data: { bookingId: booking.id, status: "checked_out" } };
});

registerCommand("reservations.confirm", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("reservations", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found", code: "NOT_FOUND" };
  if (booking.status !== "held") {
    return { ok: false, error: `Not a hold (${booking.status})`, code: "STATE" };
  }
  booking.status = "confirmed";
  ctx.emit({
    type: "booking.confirmed",
    aggregateType: "booking",
    aggregateId: booking.id,
    payload: { confirmationNo: booking.confirmationNo },
  });
  return { ok: true, data: { bookingId: booking.id, status: "confirmed" } };
});

registerCommand("reservations.cancel", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("reservations", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found", code: "NOT_FOUND" };
  if (["checked_in", "checked_out", "cancelled"].includes(booking.status)) {
    return { ok: false, error: `Cannot cancel ${booking.status}`, code: "STATE" };
  }
  booking.status = "cancelled";
  for (const a of store.assignments) {
    if (a.bookingId === booking.id) a.active = false;
  }
  for (const line of booking.lines) line.roomId = null;
  ctx.emit({
    type: "booking.cancelled",
    aggregateType: "booking",
    aggregateId: booking.id,
    payload: {},
  });
  return { ok: true, data: { bookingId: booking.id, status: "cancelled" } };
});

registerCommand("guests.upsert", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      guestId: z.string().uuid().optional(),
      fullName: z.string().min(1),
      nationality: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      vip: z.boolean().optional(),
      passportOrCid: z.string().min(4).max(64).optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("guests", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  let guest = input.guestId
    ? store.guests.find((g) => g.id === input.guestId && g.propertyId === input.propertyId)
    : undefined;
  if (guest) {
    guest.fullName = input.fullName;
    if (input.nationality !== undefined) guest.nationality = input.nationality;
    if (input.phone !== undefined) guest.phone = input.phone;
    if (input.email !== undefined) guest.email = input.email;
    if (input.vip !== undefined) guest.vip = input.vip;
    if (input.passportOrCid !== undefined) guest.passportOrCid = input.passportOrCid;
  } else {
    guest = {
      id: crypto.randomUUID(),
      propertyId: input.propertyId,
      fullName: input.fullName,
      nationality: input.nationality ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      vip: input.vip ?? false,
      passportOrCid: input.passportOrCid ?? null,
    };
    store.guests.push(guest);
  }
  const db = getDb();
  if (db) {
    const persisted = await upsertGuestPersist(db, {
      propertyId: input.propertyId,
      guestId: guest.id,
      fullName: guest.fullName,
      nationality: guest.nationality,
      phone: guest.phone,
      email: guest.email,
      vip: guest.vip,
      passportOrCid: guest.passportOrCid ?? null,
    });
    if (!persisted.ok) {
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }
  if (guest.vip) {
    ctx.emit({
      type: "guest.vip_flagged",
      aggregateType: "guest",
      aggregateId: guest.id,
      payload: {},
    });
  }
  ctx.audit({
    action: "guests.upsert",
    entityType: "guest",
    entityId: guest.id,
    after: guest,
  });
  return { ok: true, data: guest };
});

registerCommand("reservations.updateGuestRoster", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      guestName: z.string().min(1).max(160).optional(),
      passportOrCid: z.string().max(64).optional(),
      nationality: z.string().max(80).optional(),
      companionName: z.string().max(160).nullable().optional(),
      companionPassportOrCid: z.string().max(64).nullable().optional(),
      companionNationality: z.string().max(80).nullable().optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("guests", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found", code: "NOT_FOUND" };

  const guestName = (input.guestName?.trim() || booking.guestName).trim();
  if (!guestName) {
    return { ok: false, error: "Guest name is required", code: "VALIDATION" };
  }

  let passportOrCid: string | null | undefined = undefined;
  if (input.passportOrCid !== undefined) {
    const rawId = input.passportOrCid.trim();
    if (!rawId || /^pending$/i.test(rawId) || /^PARTY:/i.test(rawId)) {
      passportOrCid = rawId || null;
    } else if (rawId.length < 4) {
      return {
        ok: false,
        error: "Passport / CID must be at least 4 characters",
        code: "VALIDATION",
      };
    } else {
      passportOrCid = rawId;
    }
  }

  const nationality =
    input.nationality !== undefined
      ? input.nationality.trim() || null
      : undefined;

  let guest = booking.guestId
    ? store.guests.find((g) => g.id === booking.guestId && g.propertyId === input.propertyId)
    : undefined;
  if (guest) {
    guest.fullName = guestName;
    if (nationality !== undefined) guest.nationality = nationality;
    if (passportOrCid !== undefined) guest.passportOrCid = passportOrCid;
  } else {
    guest = {
      id: crypto.randomUUID(),
      propertyId: input.propertyId,
      fullName: guestName,
      nationality: nationality ?? null,
      phone: null,
      email: null,
      vip: false,
      passportOrCid: passportOrCid ?? null,
    };
    store.guests.push(guest);
  }

  booking.guestId = guest.id;
  booking.guestName = guestName;

  if (input.companionName !== undefined) {
    const name = input.companionName?.trim() || null;
    booking.companionName = name;
    if (!name) {
      booking.companionPassportOrCid = null;
      booking.companionNationality = null;
    }
  }
  if (input.companionPassportOrCid !== undefined && booking.companionName) {
    const cid = input.companionPassportOrCid?.trim() || null;
    if (cid && cid.length < 4) {
      return {
        ok: false,
        error: "Companion passport / CID must be at least 4 characters",
        code: "VALIDATION",
      };
    }
    booking.companionPassportOrCid = cid;
  }
  if (input.companionNationality !== undefined && booking.companionName) {
    booking.companionNationality =
      input.companionNationality?.trim() || null;
  }

  const db = getDb();
  if (db) {
    const guestPersisted = await upsertGuestPersist(db, {
      propertyId: input.propertyId,
      guestId: guest.id,
      fullName: guest.fullName,
      nationality: guest.nationality,
      phone: guest.phone,
      email: guest.email,
      vip: guest.vip,
      passportOrCid: guest.passportOrCid ?? null,
    });
    if (!guestPersisted.ok) {
      return { ok: false, error: guestPersisted.error, code: "PERSIST" };
    }
    const rosterPersisted = await updateBookingGuestRosterPersist(db, {
      propertyId: input.propertyId,
      bookingId: booking.id,
      guestId: guest.id,
      companionName: booking.companionName ?? null,
      companionPassportOrCid: booking.companionPassportOrCid ?? null,
      companionNationality: booking.companionNationality ?? null,
    });
    if (!rosterPersisted.ok) {
      return { ok: false, error: rosterPersisted.error, code: "PERSIST" };
    }
  }

  ctx.audit({
    action: "reservations.updateGuestRoster",
    entityType: "booking",
    entityId: booking.id,
    after: {
      guestId: guest.id,
      guestName,
      companionName: booking.companionName ?? null,
    },
  });
  return {
    ok: true,
    data: {
      bookingId: booking.id,
      guestId: guest.id,
      guestName,
      passportOrCid: guest.passportOrCid ?? null,
      nationality: guest.nationality,
      companionName: booking.companionName ?? null,
      companionPassportOrCid: booking.companionPassportOrCid ?? null,
      companionNationality: booking.companionNationality ?? null,
    },
  };
});

registerCommand("groups.create", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      name: z.string().min(1),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("groups", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const row = {
    id: crypto.randomUUID(),
    propertyId: input.propertyId,
    name: input.name,
    agentId: null as string | null,
  };
  store.groups.push(row);
  ctx.emit({
    type: "group.block_created",
    aggregateType: "group",
    aggregateId: row.id,
    payload: { name: row.name },
  });
  return { ok: true, data: row };
});

registerCommand("night_audit.run", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("night_audit", "run")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const prop = store.ensureDemoProperty(input.propertyId);
  const businessDate = prop.currentBusinessDate;

  const already = store.auditRuns.find(
    (a) => a.propertyId === input.propertyId && a.businessDate === businessDate,
  );
  if (already) {
    return { ok: true, data: { businessDate, status: "already_closed", idempotent: true } };
  }

  const inHouse = store.bookings.filter(
    (b) => b.propertyId === input.propertyId && b.status === "checked_in",
  );
  const financeFn = commandHandlers.get("finance.postCharge");
  if (!financeFn) {
    return { ok: false, error: "finance.postCharge unavailable", code: "INTERNAL" };
  }
  let posted = 0;
  for (const booking of inHouse) {
    if (!(booking.checkIn <= businessDate && businessDate < booking.checkOut)) continue;
    const useMaster =
      Boolean(booking.groupId) || booking.source === "agent_portal";
    const agencyFolio = store.folios.find(
      (f) => f.bookingId === booking.id && f.payerType === "agent" && f.status === "open",
    );
    const guestFolio = store.folios.find(
      (f) => f.bookingId === booking.id && f.payerType === "guest" && f.status === "open",
    );
    const folio =
      useMaster && agencyFolio ? agencyFolio : guestFolio ?? agencyFolio;
    if (!folio) continue;
    const stream = folio.payerType === "agent" ? "master" : "personal";
    for (const line of booking.lines) {
      const net = line.netAmount ?? 0;
      if (net <= 0) continue;
      const desc = `Night audit room · ${businessDate}`;
      const already = store.folioLines.some(
        (l) =>
          l.folioId === folio.id &&
          l.description === desc &&
          l.sourceType !== "reversal",
      );
      if (already) continue;
      const charged = await financeFn(
        {
          propertyId: input.propertyId,
          folioId: folio.id,
          description: desc,
          netAmount: net,
          kind: "room",
          stream,
          idempotencyKey: crypto.randomUUID(),
        },
        ctx,
      );
      if (!charged.ok) return charged;
      posted += 1;
    }
  }

  const holds = store.bookings.filter(
    (b) =>
      b.propertyId === input.propertyId &&
      b.status === "held" &&
      b.checkIn <= businessDate,
  );
  for (const h of holds) h.status = "expired";

  const noShows = store.bookings.filter(
    (b) =>
      b.propertyId === input.propertyId &&
      b.status === "confirmed" &&
      b.checkIn <= businessDate,
  );
  for (const n of noShows) {
    n.status = "no_show";
    ctx.emit({
      type: "audit.no_show",
      aggregateType: "booking",
      aggregateId: n.id,
      payload: {},
    });
  }

  const [y, m, d] = businessDate.split("-").map(Number);
  const next = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + 1));
  const nextDate = next.toISOString().slice(0, 10);
  prop.currentBusinessDate = nextDate;

  store.auditRuns.push({
    propertyId: input.propertyId,
    businessDate,
    status: "completed",
  });

  const dbAudit = getDb();
  if (dbAudit) {
    const persisted = await advanceBusinessDatePersist(dbAudit, {
      propertyId: input.propertyId,
      nextDate,
    });
    if (!persisted.ok) {
      prop.currentBusinessDate = businessDate;
      store.auditRuns.pop();
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }

  ctx.emit({
    type: "audit.room_night_posted",
    aggregateType: "business_date",
    aggregateId: input.propertyId,
    payload: { businessDate, posted },
  });
  ctx.emit({
    type: "audit.day_closed",
    aggregateType: "business_date",
    aggregateId: input.propertyId,
    payload: { businessDate, nextDate },
  });
  ctx.audit({
    action: "night_audit.run",
    entityType: "business_date",
    after: { businessDate, nextDate, posted, noShows: noShows.length, expired: holds.length },
  });

  return {
    ok: true,
    data: {
      businessDate,
      nextDate,
      postedNights: posted,
      noShows: noShows.length,
      expiredHolds: holds.length,
      status: "closed",
    },
  };
});
