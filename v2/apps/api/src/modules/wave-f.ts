import { permission } from "@hos-v2/domain";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
} from "../platform/command.js";
import { registerCommand } from "./registry.js";

registerCommand("purchases.receiveGrn", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      poId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("purchases", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  return { ok: true, data: { grnId: crypto.randomUUID(), poId: input.poId } };
});

registerCommand("purchases.approveBill", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      billId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("purchases", "bills")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  ctx.emit({
    type: "purchase.bill_approved",
    aggregateType: "purchase_bill",
    aggregateId: input.billId,
    payload: {},
  });
  return { ok: true, data: { billId: input.billId } };
});

registerCommand("staff_portal.clockIn", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      staffId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  ctx.emit({
    type: "staff.clocked_in",
    aggregateType: "staff",
    aggregateId: input.staffId,
    payload: {},
  });
  return { ok: true, data: { staffId: input.staffId, at: new Date().toISOString() } };
});

registerCommand("owner.dashboardSnapshot", async (raw, ctx) => {
  const input = z.object({ propertyId: z.string().uuid() }).parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("owner", "view")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  return {
    ok: true,
    data: {
      occupancy: null,
      revenueToday: null,
      note: "Live tiles subscribe to money/booking events — no demo numbers",
    },
  };
});

registerCommand("loyalty.enrol", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      guestId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("loyalty", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  return { ok: true, data: { accountId: crypto.randomUUID(), guestId: input.guestId } };
});

registerCommand("superadmin.createTenant", async (raw, ctx) => {
  const input = z
    .object({
      name: z.string().min(1),
      slug: z.string().min(1),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = assertPermission(ctx.actor, permission("superadmin", "write"));
  if (denied) return denied;
  const orgId = crypto.randomUUID();
  const propertyId = crypto.randomUUID();
  ctx.emit({
    type: "licence.changed",
    aggregateType: "tenant",
    aggregateId: orgId,
    payload: { slug: input.slug },
  });
  return { ok: true, data: { organizationId: orgId, propertyId, slug: input.slug } };
});
