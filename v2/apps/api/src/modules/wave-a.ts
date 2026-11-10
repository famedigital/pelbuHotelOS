import { quoteNight, permission, type RateEntryMode } from "@hos-v2/domain";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
} from "../platform/command.js";
import { store } from "../platform/memory-store.js";
import { registerCommand } from "./registry.js";

function datesInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

const upsertRoomTypeSchema = z.object({
  propertyId: z.string().uuid(),
  code: z.string().min(1).max(32),
  name: z.string().min(1),
  baseOccupancy: z.number().int().positive().default(2),
  idempotencyKey: idempotencyKeySchema,
});

registerCommand("settings.upsertRoomType", async (raw, ctx) => {
  const input = upsertRoomTypeSchema.parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("settings", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  store.ensureDemoProperty(input.propertyId);
  const existing = store.roomTypes.find(
    (r) => r.propertyId === input.propertyId && r.code === input.code,
  );
  /* Prefer idempotencyKey as stable id so desk ROOM_TYPE_IDS stay aligned. */
  const fromKey =
    typeof input.idempotencyKey === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.idempotencyKey,
    )
      ? input.idempotencyKey
      : null;
  const id = existing?.id ?? fromKey ?? crypto.randomUUID();
  const row = {
    id,
    propertyId: input.propertyId,
    code: input.code,
    name: input.name,
    baseOccupancy: input.baseOccupancy,
  };
  if (existing) {
    Object.assign(existing, row);
  } else {
    store.roomTypes.push(row);
  }

  ctx.audit({
    action: "settings.upsertRoomType",
    entityType: "room_type",
    entityId: id,
    after: row,
  });
  ctx.emit({
    type: "room.created",
    aggregateType: "room_type",
    aggregateId: id,
    payload: { code: input.code, name: input.name },
  });
  return { ok: true, data: row };
});

registerCommand("settings.createRoom", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      roomTypeId: z.string().uuid(),
      number: z.string().min(1),
      floor: z.string().optional(),
      /** Deterministic id for desk↔API room mapping (optional). */
      id: z.string().uuid().optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("settings", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const typeOk = store.roomTypes.some(
    (t) => t.id === input.roomTypeId && t.propertyId === input.propertyId,
  );
  if (!typeOk) return { ok: false, error: "Unknown room type", code: "NOT_FOUND" };

  const dup = store.rooms.find(
    (r) => r.propertyId === input.propertyId && r.number === input.number,
  );
  if (dup) {
    return { ok: true, data: dup };
  }
  if (input.id) {
    const byId = store.rooms.find((r) => r.id === input.id);
    if (byId) return { ok: true, data: byId };
  }

  const row = {
    id: input.id ?? crypto.randomUUID(),
    propertyId: input.propertyId,
    roomTypeId: input.roomTypeId,
    number: input.number,
    floor: input.floor ?? null,
    hkStatus: "clean",
  };
  store.rooms.push(row);
  ctx.audit({
    action: "settings.createRoom",
    entityType: "room",
    entityId: row.id,
    after: row,
  });
  return { ok: true, data: row };
});

registerCommand("settings.updateProperty", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      name: z.string().min(1).optional(),
      scRate: z.number().min(0).max(1).optional(),
      gstRate: z.number().min(0).max(1).optional(),
      gstEnabled: z.boolean().optional(),
      checkInTime: z.string().optional(),
      checkOutTime: z.string().optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("settings", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const p = store.ensureDemoProperty(input.propertyId);
  if (input.name !== undefined) p.name = input.name;
  if (input.scRate !== undefined) p.scRate = input.scRate;
  if (input.gstRate !== undefined) p.gstRate = input.gstRate;
  if (input.gstEnabled !== undefined) p.gstEnabled = input.gstEnabled;
  if (input.checkInTime !== undefined) p.checkInTime = input.checkInTime;
  if (input.checkOutTime !== undefined) p.checkOutTime = input.checkOutTime;

  ctx.audit({
    action: "settings.updateProperty",
    entityType: "property",
    entityId: p.id,
    after: p,
  });
  if (input.scRate !== undefined || input.gstRate !== undefined || input.gstEnabled !== undefined) {
    ctx.emit({
      type: "settings.tax_changed",
      aggregateType: "property",
      aggregateId: p.id,
      payload: { scRate: p.scRate, gstRate: p.gstRate, gstEnabled: p.gstEnabled },
    });
  }
  return { ok: true, data: p };
});

registerCommand("hr.createStaff", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      displayName: z.string().min(1),
      role: z.string().min(1),
      pin: z.string().min(4).max(8).optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("hr", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const row = {
    id: crypto.randomUUID(),
    propertyId: input.propertyId,
    displayName: input.displayName,
    role: input.role,
    pinSet: Boolean(input.pin),
    active: true,
  };
  store.staff.push(row);
  ctx.audit({
    action: "hr.createStaff",
    entityType: "staff",
    entityId: row.id,
    after: { ...row, pin: undefined },
  });
  return { ok: true, data: row };
});

registerCommand("hr.setStaffPin", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      staffId: z.string().uuid(),
      pin: z.string().min(4).max(8),
      role: z.string().min(1).optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("hr", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const staff = store.staff.find(
    (s) => s.id === input.staffId && s.propertyId === input.propertyId,
  );
  if (!staff) return { ok: false, error: "Staff not found", code: "NOT_FOUND" };
  staff.pinSet = true;
  if (input.role) staff.role = input.role;

  ctx.audit({
    action: "hr.setStaffPin",
    entityType: "staff",
    entityId: staff.id,
    after: { role: staff.role, pinSet: true },
  });
  ctx.emit({
    type: "staff.role_changed",
    aggregateType: "staff",
    aggregateId: staff.id,
    payload: { role: staff.role },
  });
  return { ok: true, data: staff };
});

registerCommand("rates.createPlan", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      code: z.string().min(1),
      name: z.string().min(1),
      mealPlan: z.enum(["EP", "CP", "MAP", "AP"]).default("EP"),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("rates", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const existing = store.ratePlans.find(
    (p) => p.propertyId === input.propertyId && p.code === input.code,
  );
  if (existing) return { ok: false, error: "Rate plan code exists", code: "CONFLICT" };

  const row = {
    id: crypto.randomUUID(),
    propertyId: input.propertyId,
    code: input.code,
    name: input.name,
    mealPlan: input.mealPlan,
    currency: "BTN",
  };
  store.ratePlans.push(row);
  ctx.audit({
    action: "rates.createPlan",
    entityType: "rate_plan",
    entityId: row.id,
    after: row,
  });
  return { ok: true, data: row };
});

registerCommand("rates.quoteNight", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      typedAmountBtn: z.number().nonnegative(),
      mode: z.enum(["net", "incl_sc", "all_in"]) as z.ZodType<RateEntryMode>,
      gstRate: z.number().min(0).max(1).optional(),
      serviceChargeRate: z.number().min(0).max(1).optional(),
      scApplicable: z.boolean().optional(),
      gstApplicable: z.boolean().optional(),
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("rates", "view")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const p = store.ensureDemoProperty(input.propertyId);
  const breakdown = quoteNight(input.typedAmountBtn, input.mode, {
    gstRate: input.gstRate ?? (p.gstEnabled ? p.gstRate : 0),
    serviceChargeRate: input.serviceChargeRate ?? p.scRate,
    scApplicable: input.scApplicable,
    gstApplicable: input.gstApplicable ?? p.gstEnabled,
  });
  return { ok: true, data: breakdown };
});

registerCommand("rates.publishRange", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      ratePlanId: z.string().uuid(),
      roomTypeId: z.string().uuid(),
      fromDate: z.string(),
      toDate: z.string(),
      typedAmountBtn: z.number().nonnegative(),
      mode: z.enum(["net", "incl_sc", "all_in"]).default("net"),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("rates", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const plan = store.ratePlans.find(
    (p) => p.id === input.ratePlanId && p.propertyId === input.propertyId,
  );
  const type = store.roomTypes.find(
    (t) => t.id === input.roomTypeId && t.propertyId === input.propertyId,
  );
  if (!plan || !type) {
    return { ok: false, error: "Rate plan or room type missing", code: "NOT_FOUND" };
  }

  const p = store.ensureDemoProperty(input.propertyId);
  const quoted = quoteNight(input.typedAmountBtn, input.mode, {
    gstRate: p.gstEnabled ? p.gstRate : 0,
    serviceChargeRate: p.scRate,
  });
  const days = datesInclusive(input.fromDate, input.toDate);
  let upserted = 0;
  for (const stayDate of days) {
    const existing = store.rates.find(
      (r) =>
        r.ratePlanId === input.ratePlanId &&
        r.roomTypeId === input.roomTypeId &&
        r.stayDate === stayDate,
    );
    if (existing) {
      existing.netAmount = quoted.amountBtn;
    } else {
      store.rates.push({
        id: crypto.randomUUID(),
        propertyId: input.propertyId,
        ratePlanId: input.ratePlanId,
        roomTypeId: input.roomTypeId,
        stayDate,
        netAmount: quoted.amountBtn,
      });
    }
    upserted += 1;
  }

  ctx.audit({
    action: "rates.publishRange",
    entityType: "rate_plan",
    entityId: input.ratePlanId,
    after: { ...input, netAmount: quoted.amountBtn, days: upserted },
  });
  ctx.emit({
    type: "rate.changed",
    aggregateType: "rate_plan",
    aggregateId: input.ratePlanId,
    payload: {
      roomTypeId: input.roomTypeId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      netAmount: quoted.amountBtn,
    },
  });
  return {
    ok: true,
    data: { published: upserted, netAmount: quoted.amountBtn, quote: quoted },
  };
});
