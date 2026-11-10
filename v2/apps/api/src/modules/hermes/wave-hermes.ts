import { randomBytes, randomUUID } from "node:crypto";
import { permission } from "@hos-v2/domain";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
  type Actor,
} from "../../platform/command.js";
import { store, type HermesRole, type HermesTopicKind } from "../../platform/memory-store.js";
import { registerCommand } from "../registry.js";
import { applyOcrToBooking } from "./apply-roster.js";
import { pairingDeepLink, sendMessage, telegramBotToken, telegramBotUsername } from "./bot-api.js";
import { ocrIdentityOrSdf } from "./ocr.js";

const hermesRoleSchema = z.enum(["fo", "manager", "hk", "kitchen", "gm", "agent"]);
const topicKindSchema = z.enum([
  "front_office",
  "housekeeping",
  "kitchen_pos",
  "management_audit",
  "guides_drivers",
]);

function requireHermesWrite(actor: Actor, propertyId: string) {
  return (
    assertPermission(actor, permission("guests", "write")) ??
    assertProperty(actor, propertyId)
  );
}

registerCommand("hermes.createPairToken", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      role: hermesRoleSchema.default("fo"),
      agentId: z.string().min(1).optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;
  if (input.role === "agent" && !input.agentId) {
    return { ok: false, error: "agentId required for agent role", code: "VALIDATION" };
  }

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const row = {
    id: randomUUID(),
    propertyId: input.propertyId,
    token,
    role: input.role as HermesRole,
    agentId: input.role === "agent" ? (input.agentId ?? null) : null,
    expiresAt,
    usedAt: null as string | null,
    usedChatId: null as number | null,
    createdAt: new Date().toISOString(),
  };
  store.telegramPairTokens.push(row);
  const deepLink = pairingDeepLink(token);
  ctx.audit({
    action: "hermes.createPairToken",
    entityType: "telegram_pair_token",
    entityId: row.id,
  });
  return {
    ok: true,
    data: {
      token,
      role: row.role,
      agentId: row.agentId,
      expiresAt,
      deepLink,
      botUsername: telegramBotUsername(),
    },
  };
});

registerCommand("hermes.linkStaff", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      tgUserId: z.number().int(),
      staffName: z.string().min(1).max(120),
      role: z.enum(["fo", "manager", "hk", "kitchen", "gm"]),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;
  const existing = store.telegramStaffLinks.find(
    (l) =>
      l.propertyId === input.propertyId &&
      l.tgUserId === input.tgUserId &&
      l.active,
  );
  if (existing) {
    existing.role = input.role;
    existing.staffName = input.staffName;
    return { ok: true, data: { link: existing } };
  }
  const link = {
    id: randomUUID(),
    propertyId: input.propertyId,
    tgUserId: input.tgUserId,
    staffName: input.staffName,
    role: input.role as Exclude<HermesRole, "agent">,
    linkedAt: new Date().toISOString(),
    active: true,
  };
  store.telegramStaffLinks.push(link);
  ctx.audit({
    action: "hermes.linkStaff",
    entityType: "telegram_staff_link",
    entityId: link.id,
  });
  return { ok: true, data: { link } };
});

registerCommand("hermes.listStaffLinks", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema.optional(),
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;
  return {
    ok: true,
    data: {
      links: store.telegramStaffLinks.filter(
        (l) => l.propertyId === input.propertyId && l.active,
      ),
    },
  };
});

registerCommand("hermes.bindTopic", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      chatId: z.number().int(),
      threadId: z.number().int(),
      kind: topicKindSchema,
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;
  const chat = store.telegramChats.find(
    (c) =>
      c.propertyId === input.propertyId &&
      c.chatId === input.chatId &&
      c.status === "active",
  );
  if (!chat) return { ok: false, error: "Ops chat not paired", code: "NOT_FOUND" };
  const existing = store.telegramTopics.find(
    (t) =>
      t.propertyId === input.propertyId &&
      t.chatId === input.chatId &&
      t.kind === input.kind,
  );
  if (existing) {
    existing.threadId = input.threadId;
    return { ok: true, data: { topic: existing } };
  }
  const topic = {
    id: randomUUID(),
    propertyId: input.propertyId,
    chatId: input.chatId,
    threadId: input.threadId,
    kind: input.kind as HermesTopicKind,
  };
  store.telegramTopics.push(topic);
  return { ok: true, data: { topic } };
});

registerCommand("hermes.postDepartmentPass", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      pass: z.enum(["kitchen", "fb", "hk", "fo"]),
      text: z.string().min(1).max(3500),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;

  const kindMap: Record<string, HermesTopicKind> = {
    kitchen: "kitchen_pos",
    fb: "kitchen_pos",
    hk: "housekeeping",
    fo: "front_office",
  };
  const kind = kindMap[input.pass]!;
  const topic = store.telegramTopics.find(
    (t) => t.propertyId === input.propertyId && t.kind === kind,
  );
  const chat =
    (topic
      ? store.telegramChats.find(
          (c) =>
            c.propertyId === input.propertyId &&
            c.chatId === topic.chatId &&
            c.status === "active",
        )
      : null) ??
    store.telegramChats.find(
      (c) =>
        c.propertyId === input.propertyId &&
        c.status === "active" &&
        (c.chatType === "supergroup" || c.chatType === "group"),
    ) ??
    store.telegramChats.find(
      (c) => c.propertyId === input.propertyId && c.status === "active",
    );
  if (!chat) {
    return {
      ok: false,
      error: "No active Hermes chat — pair an ops group first",
      code: "NOT_FOUND",
    };
  }
  const header = `<b>Print Studio · ${input.pass.toUpperCase()}</b>\n`;
  const sent = await sendMessage(chat.chatId, `${header}${input.text}`);
  store.telegramEvents.unshift({
    id: randomUUID(),
    propertyId: input.propertyId,
    chatId: chat.chatId,
    direction: "out",
    intent: "print_studio_pass",
    payload: { pass: input.pass, topicKind: kind, ok: sent.ok },
    createdAt: new Date().toISOString(),
  });
  if (!sent.ok) {
    /* Still record locally so desk can verify routing without live bot token. */
    return {
      ok: true,
      data: {
        queued: true,
        chatId: chat.chatId,
        threadId: topic?.threadId ?? null,
        delivery: "local_only",
        error: sent.error,
      },
    };
  }
  return {
    ok: true,
    data: {
      queued: false,
      chatId: chat.chatId,
      threadId: topic?.threadId ?? null,
      delivery: "telegram",
    },
  };
});

registerCommand("hermes.listChats", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema.optional(),
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;

  const chats = store.telegramChats
    .filter((c) => c.propertyId === input.propertyId)
    .sort((a, b) => b.pairedAt.localeCompare(a.pairedAt));
  return { ok: true, data: { chats } };
});

registerCommand("hermes.revokeChat", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      chatRowId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;
  const chat = store.telegramChats.find(
    (c) => c.id === input.chatRowId && c.propertyId === input.propertyId,
  );
  if (!chat) return { ok: false, error: "Chat not found", code: "NOT_FOUND" };
  chat.status = "revoked";
  chat.revokedAt = new Date().toISOString();
  ctx.audit({
    action: "hermes.revokeChat",
    entityType: "telegram_chat",
    entityId: chat.id,
  });
  return { ok: true, data: { id: chat.id, status: chat.status } };
});

registerCommand("hermes.listDocDrafts", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      status: z.enum(["pending", "applied", "discarded", "all"]).default("pending"),
      idempotencyKey: idempotencyKeySchema.optional(),
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;
  const drafts = store.telegramDocDrafts
    .filter(
      (d) =>
        d.propertyId === input.propertyId &&
        (input.status === "all" || d.status === input.status),
    )
    .slice(0, 100);
  return { ok: true, data: { drafts } };
});

registerCommand("hermes.discardDocDraft", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      draftId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;
  const draft = store.telegramDocDrafts.find(
    (d) => d.id === input.draftId && d.propertyId === input.propertyId,
  );
  if (!draft) return { ok: false, error: "Draft not found", code: "NOT_FOUND" };
  draft.status = "discarded";
  return { ok: true, data: { id: draft.id, status: draft.status } };
});

registerCommand("hermes.applyDocDraft", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      draftId: z.string().uuid(),
      bookingId: z.string().uuid(),
      asCompanion: z.boolean().default(false),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;
  const draft = store.telegramDocDrafts.find(
    (d) => d.id === input.draftId && d.propertyId === input.propertyId,
  );
  if (!draft) return { ok: false, error: "Draft not found", code: "NOT_FOUND" };
  if (draft.status !== "pending") {
    return { ok: false, error: `Draft is ${draft.status}`, code: "CONFLICT" };
  }
  const applied = applyOcrToBooking({
    propertyId: input.propertyId,
    bookingId: input.bookingId,
    ocr: draft.ocr,
    asCompanion: input.asCompanion,
  });
  if (!applied.ok) return { ok: false, error: applied.error, code: "APPLY" };
  draft.status = "applied";
  draft.appliedStayId = input.bookingId;
  draft.appliedAt = new Date().toISOString();
  ctx.audit({
    action: "hermes.applyDocDraft",
    entityType: "telegram_doc_draft",
    entityId: draft.id,
    after: { bookingId: input.bookingId },
  });
  return {
    ok: true,
    data: {
      draftId: draft.id,
      bookingId: input.bookingId,
      guestName: applied.guestName,
      roomLabel: applied.roomLabel,
      ocr: draft.ocr,
    },
  };
});

registerCommand("hermes.ocrDocument", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      mime: z.string().default("image/jpeg"),
      dataBase64: z.string().min(1).optional(),
      hintKind: z.enum(["passport", "sdf"]).optional(),
      simulate: z.boolean().optional(),
      simulateFields: z
        .object({
          fullName: z.string().optional(),
          passportOrCid: z.string().optional(),
          nationality: z.string().optional(),
          sdfRef: z.string().optional(),
        })
        .optional(),
      createDraft: z.boolean().default(true),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;

  const simulate =
    input.simulate === true ||
    process.env.HERMES_OCR_SIMULATE === "1" ||
    (!process.env.GEMINI_API_KEY && !input.dataBase64);

  if (!simulate && !input.dataBase64) {
    return { ok: false, error: "dataBase64 required unless simulate", code: "VALIDATION" };
  }

  const ocrHit = await ocrIdentityOrSdf({
    mime: input.mime,
    dataBase64: input.dataBase64 ?? "",
    hintKind: input.hintKind,
    simulate,
    simulateFields: input.simulateFields,
  });
  if (!ocrHit.ok) return { ok: false, error: ocrHit.error, code: "OCR" };

  let draftId: string | null = null;
  if (input.createDraft) {
    const draft = {
      id: randomUUID(),
      propertyId: input.propertyId,
      kind: ocrHit.ocr.kind,
      status: "pending" as const,
      ocr: ocrHit.ocr,
      imageRef: null,
      suggestedStayId: null,
      appliedStayId: null,
      createdByChatId: null,
      createdAt: new Date().toISOString(),
      appliedAt: null,
    };
    store.telegramDocDrafts.unshift(draft);
    draftId = draft.id;
  }

  ctx.audit({
    action: "hermes.ocrDocument",
    entityType: "telegram_doc_draft",
    entityId: draftId ?? undefined,
  });
  return {
    ok: true,
    data: {
      draftId,
      ocr: ocrHit.ocr,
      botConfigured: Boolean(telegramBotToken()),
      simulated: simulate,
    },
  };
});

registerCommand("hermes.overview", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema.optional(),
    })
    .parse(raw);
  const denied = requireHermesWrite(ctx.actor, input.propertyId);
  if (denied) return denied;
  const chats = store.telegramChats.filter(
    (c) => c.propertyId === input.propertyId && c.status === "active",
  );
  const drafts = store.telegramDocDrafts.filter((d) => d.propertyId === input.propertyId);
  const pending = drafts.filter((d) => d.status === "pending").length;
  const appliedToday = drafts.filter((d) => {
    if (d.status !== "applied" || !d.appliedAt) return false;
    return d.appliedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
  }).length;
  const events = store.telegramEvents
    .filter((e) => e.propertyId === input.propertyId)
    .slice(0, 20);
  return {
    ok: true,
    data: {
      pairedChats: chats.length,
      pendingDocs: pending,
      appliedToday,
      botConfigured: Boolean(telegramBotToken()),
      botUsername: telegramBotUsername(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      simulateMode: process.env.HERMES_OCR_SIMULATE === "1",
      recentEvents: events,
      chats,
    },
  };
});
