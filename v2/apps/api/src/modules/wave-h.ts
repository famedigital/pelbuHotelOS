import { permission } from "@hos-v2/domain";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
} from "../platform/command.js";
import { registerCommand } from "./registry.js";

registerCommand("services.book", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      serviceId: z.string().uuid(),
      bookingId: z.string().uuid().optional(),
      scheduledAt: z.string(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("services", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const id = crypto.randomUUID();
  ctx.emit({
    type: "service.booked",
    aggregateType: "service_booking",
    aggregateId: id,
    payload: { serviceId: input.serviceId, scheduledAt: input.scheduledAt },
  });
  return { ok: true, data: { serviceBookingId: id } };
});

registerCommand("services.complete", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      serviceBookingId: z.string().uuid(),
      folioId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("services", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  ctx.emit({
    type: "service.completed",
    aggregateType: "service_booking",
    aggregateId: input.serviceBookingId,
    payload: { folioId: input.folioId },
  });
  return { ok: true, data: { serviceBookingId: input.serviceBookingId } };
});

registerCommand("events.confirm", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      eventId: z.string().uuid(),
      headcount: z.number().int().positive(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("events", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  ctx.emit({
    type: "event.confirmed",
    aggregateType: "banquet_event",
    aggregateId: input.eventId,
    payload: { headcount: input.headcount },
  });
  return { ok: true, data: { eventId: input.eventId, status: "confirmed" } };
});
