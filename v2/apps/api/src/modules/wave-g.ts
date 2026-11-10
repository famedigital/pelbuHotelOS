import { permission } from "@hos-v2/domain";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
} from "../platform/command.js";
import { registerCommand } from "./registry.js";

registerCommand("cms.publish", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      pageId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("cms", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  ctx.emit({
    type: "cms.published",
    aggregateType: "cms_page",
    aggregateId: input.pageId,
    payload: {},
  });
  return { ok: true, data: { pageId: input.pageId, status: "published" } };
});

registerCommand("website.searchAvailability", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      checkIn: z.string(),
      checkOut: z.string(),
    })
    .parse(raw);
  const denied = assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  return {
    ok: true,
    data: {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      roomTypes: [] as unknown[],
      note: "Cache invalidated by rate.changed / room.blocked events",
    },
  };
});

registerCommand("marketing.scheduleCampaign", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      name: z.string().min(1),
      channel: z.enum(["email", "whatsapp", "sms"]),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("marketing", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  return { ok: true, data: { campaignId: crypto.randomUUID(), name: input.name } };
});

registerCommand("ai.proposeAction", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      intent: z.string().min(1),
      commandName: z.string().min(1),
      commandInput: z.record(z.unknown()),
    })
    .parse(raw);
  const denied = assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  ctx.audit({
    action: "ai.action_proposed",
    entityType: "ai_action",
    after: { intent: input.intent, commandName: input.commandName },
  });
  ctx.emit({
    type: "ai.action_proposed",
    aggregateType: "ai_action",
    aggregateId: crypto.randomUUID(),
    payload: {
      intent: input.intent,
      commandName: input.commandName,
      requiresConfirm: true,
    },
  });
  return {
    ok: true,
    data: {
      status: "pending_confirm",
      commandName: input.commandName,
      note: "Money actions also require manager PIN — never direct DB write",
    },
  };
});
