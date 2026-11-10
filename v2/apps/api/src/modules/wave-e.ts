import { permission } from "@hos-v2/domain";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
} from "../platform/command.js";
import { registerCommand } from "./registry.js";

registerCommand("agents.create", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      name: z.string().min(1),
      code: z.string().min(1),
      creditLimit: z.number().nonnegative().default(0),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("agents", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const id = crypto.randomUUID();
  ctx.emit({
    type: "agent.updated",
    aggregateType: "agent",
    aggregateId: id,
    payload: { name: input.name, code: input.code },
  });
  return { ok: true, data: { id, code: input.code } };
});

registerCommand("agents.creditHold", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      agentId: z.string().uuid(),
      hold: z.boolean(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("agents", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  ctx.emit({
    type: "agent.credit_hold",
    aggregateType: "agent",
    aggregateId: input.agentId,
    payload: { hold: input.hold },
  });
  return { ok: true, data: { agentId: input.agentId, hold: input.hold } };
});

registerCommand("agents.recordPayment", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      agentId: z.string().uuid(),
      amount: z.number().positive(),
      method: z.enum(["bank", "cash", "mbob", "card"]).default("bank"),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("agents", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const paymentId = crypto.randomUUID();
  ctx.audit({
    action: "agents.recordPayment",
    entityType: "agent",
    entityId: input.agentId,
    after: { paymentId, amount: input.amount, method: input.method },
  });
  ctx.emit({
    type: "agent.payment_received",
    aggregateType: "agent",
    aggregateId: input.agentId,
    payload: { paymentId, amount: input.amount, method: input.method },
  });
  return {
    ok: true,
    data: { paymentId, agentId: input.agentId, amount: input.amount },
  };
});

registerCommand("agents.decideChangeRequest", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      changeRequestId: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("reservations", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  ctx.emit({
    type: "change_request.decided",
    aggregateType: "change_request",
    aggregateId: input.changeRequestId,
    payload: { decision: input.decision },
  });
  return { ok: true, data: input };
});

registerCommand("registry.upsertGuide", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      name: z.string().min(1),
      cid: z.string().optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("registry", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const id = crypto.randomUUID();
  ctx.emit({
    type: "guide.updated",
    aggregateType: "guide",
    aggregateId: id,
    payload: { name: input.name },
  });
  return { ok: true, data: { id, name: input.name } };
});

registerCommand("channel.acceptBooking", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      channelBookingId: z.string().uuid(),
      guestName: z.string().min(1).default("Channel Guest"),
      checkIn: z.string().optional(),
      checkOut: z.string().optional(),
      roomTypeId: z.string().uuid().optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("channel", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const { store } = await import("../platform/memory-store.js");
  const { commandHandlers } = await import("./registry.js");
  store.ensureDemoProperty(input.propertyId);
  const roomTypeId =
    input.roomTypeId ??
    store.roomTypes.find((t) => t.propertyId === input.propertyId)?.id;
  if (!roomTypeId) {
    return { ok: false, error: "No room type — seed inventory first", code: "NOT_FOUND" };
  }
  const today = store.ensureDemoProperty(input.propertyId).currentBusinessDate;
  const checkIn = input.checkIn ?? today;
  const checkOut =
    input.checkOut ??
    (() => {
      const d = new Date(`${checkIn}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 2);
      return d.toISOString().slice(0, 10);
    })();

  const createFn = commandHandlers.get("reservations.createReservation");
  if (!createFn) {
    return { ok: false, error: "createReservation handler missing", code: "INTERNAL" };
  }
  const created = await createFn(
    {
      propertyId: input.propertyId,
      guestName: input.guestName,
      checkIn,
      checkOut,
      roomTypeId,
      source: "channel",
      confirm: true,
      idempotencyKey: input.idempotencyKey,
    },
    ctx,
  );
  if (!created.ok) return created;

  const data = created.data as { bookingId: string; folioId?: string };
  ctx.emit({
    type: "channel.booking_received",
    aggregateType: "channel_booking",
    aggregateId: input.channelBookingId,
    payload: {
      bookingId: data.bookingId,
      source: "channel",
    },
  });
  return {
    ok: true,
    data: {
      channelBookingId: input.channelBookingId,
      bookingId: data.bookingId,
      folioId: data.folioId,
      routed: "reservations.createReservation",
    },
  };
});
