import { randomUUID } from "node:crypto";
import { store, type TelegramDocDraftRow } from "../../platform/memory-store.js";
import {
  answerCallbackQuery,
  getFileBase64,
  sendMessage,
  type InlineButton,
} from "./bot-api.js";
import { canHermes, hermesHelpForRole } from "./hermes-acl.js";
import {
  agentHasActiveMou,
  hermesArrivalsSummary,
  hermesAuditFlash,
  hermesInventoryForProperty,
  hermesKitchenCovers,
  hermesMarkRoomClean,
  hermesOccSummary,
  hermesSearchGuests,
  hermesTodaySummary,
} from "./hermes-queries.js";
import { ocrIdentityOrSdf } from "./ocr.js";
import { applyOcrToBooking } from "./apply-roster.js";

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    message_thread_id?: number;
    chat: {
      id: number;
      type?: string;
      title?: string;
      username?: string;
    };
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; width?: number; height?: number }>;
    from?: { id?: number; first_name?: string; username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: { id?: number; first_name?: string; username?: string };
    message?: { chat: { id: number }; message_thread_id?: number };
  };
};

const seenUpdates = new Map<number, number>();
const DEDUPE_TTL_MS = 10 * 60 * 1000;

export function rememberUpdateId(updateId: number | undefined): boolean {
  if (updateId == null || !Number.isFinite(updateId)) return false;
  const now = Date.now();
  for (const [id, at] of seenUpdates) {
    if (now - at > DEDUPE_TTL_MS) seenUpdates.delete(id);
  }
  if (seenUpdates.has(updateId)) return true;
  seenUpdates.set(updateId, now);
  return false;
}

function logEvent(
  propertyId: string,
  chatId: number | null,
  direction: "in" | "out" | "system",
  intent: string,
  payload: Record<string, unknown>,
) {
  store.telegramEvents.unshift({
    id: randomUUID(),
    propertyId,
    chatId,
    direction,
    intent,
    payload,
    createdAt: new Date().toISOString(),
  });
  if (store.telegramEvents.length > 500) store.telegramEvents.length = 500;
}

function parseStartPair(text: string | undefined): string | null {
  if (!text) return null;
  const m = text.trim().match(/^\/start(?:@\w+)?\s+pair_([a-f0-9]{12,64})$/i);
  return m?.[1] ?? null;
}

function roomChoices(propertyId: string): InlineButton[][] {
  const day =
    store.properties.get(propertyId)?.currentBusinessDate ??
    new Date().toISOString().slice(0, 10);
  const candidates = store.bookings.filter(
    (b) =>
      b.propertyId === propertyId &&
      !["cancelled", "no_show", "checked_out", "expired"].includes(b.status) &&
      (b.status === "checked_in" || b.checkIn === day || b.checkIn <= day),
  );
  const buttons: InlineButton[] = [];
  for (const b of candidates.slice(0, 12)) {
    const room =
      b.lines
        .map((l) => store.rooms.find((r) => r.id === l.roomId)?.number)
        .find(Boolean) ?? "—";
    const label = `${room} · ${b.guestName}`.slice(0, 58);
    buttons.push({ text: label, callback_data: `attach:${b.id}` });
  }
  const rows: InlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += 1) {
    rows.push([buttons[i]!]);
  }
  if (!rows.length) {
    rows.push([{ text: "No arrivals / in-house", callback_data: "noop" }]);
  }
  return rows;
}

function resolveStaffLinked(
  propertyId: string,
  tgUserId: number | undefined,
): { linked: boolean; roleOverride: import("../../platform/memory-store.js").HermesRole | null } {
  if (tgUserId == null) return { linked: false, roleOverride: null };
  const link = store.telegramStaffLinks.find(
    (l) => l.propertyId === propertyId && l.tgUserId === tgUserId && l.active,
  );
  if (!link) return { linked: false, roleOverride: null };
  return { linked: true, roleOverride: link.role };
}

async function handlePair(
  chatId: number,
  token: string,
  displayName: string | null,
  chatTypeRaw: string | undefined,
) {
  const row = store.telegramPairTokens.find((t) => t.token === token);
  if (!row || row.usedAt) {
    await sendMessage(chatId, "Pair link invalid or already used.");
    return;
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await sendMessage(chatId, "Pair link expired — create a new one on desk Hermes.");
    return;
  }
  row.usedAt = new Date().toISOString();
  row.usedChatId = chatId;
  const existing = store.telegramChats.find(
    (c) => c.chatId === chatId && c.status === "active",
  );
  if (existing && existing.propertyId !== row.propertyId) {
    existing.status = "revoked";
    existing.revokedAt = new Date().toISOString();
  }
  const chatType =
    chatTypeRaw === "group" || chatTypeRaw === "supergroup"
      ? chatTypeRaw
      : "private";
  let chat = store.telegramChats.find(
    (c) => c.propertyId === row.propertyId && c.chatId === chatId,
  );
  if (chat) {
    chat.status = "active";
    chat.role = row.role;
    chat.chatType = chatType;
    chat.displayName = displayName;
    chat.agentId = row.agentId;
    chat.revokedAt = null;
    chat.pairedAt = new Date().toISOString();
    chat.lastSeenAt = new Date().toISOString();
  } else {
    chat = {
      id: randomUUID(),
      propertyId: row.propertyId,
      chatId,
      chatType,
      role: row.role,
      status: "active",
      displayName,
      tgUsername: null,
      agentId: row.agentId,
      activeMouPropertyId: row.role === "agent" ? row.propertyId : null,
      pairedAt: new Date().toISOString(),
      revokedAt: null,
      lastSeenAt: new Date().toISOString(),
    };
    store.telegramChats.push(chat);
  }
  if (row.role === "agent" && row.agentId) {
    const has = store.mouLinks.some(
      (m) =>
        m.agentId === row.agentId &&
        m.propertyId === row.propertyId &&
        m.status === "active",
    );
    if (!has) {
      store.mouLinks.push({
        id: randomUUID(),
        propertyId: row.propertyId,
        agentId: row.agentId,
        status: "active",
      });
    }
  }
  const prop = store.ensureDemoProperty(row.propertyId);
  logEvent(row.propertyId, chatId, "in", "pair", {
    role: row.role,
    chatType,
    agentId: row.agentId,
  });
  await sendMessage(
    chatId,
    `Paired to <b>${prop.name}</b> as <b>${row.role}</b> (${chatType}).\n\n${hermesHelpForRole(row.role)}`,
  );
}

function activeChat(chatId: number) {
  return store.telegramChats.find((c) => c.chatId === chatId && c.status === "active");
}

async function handleTextCommand(
  chatId: number,
  text: string,
  tgUserId: number | undefined,
): Promise<{ handled: boolean; detail: string }> {
  const chat = activeChat(chatId);
  if (!chat) return { handled: false, detail: "unpaired" };

  const staff = resolveStaffLinked(chat.propertyId, tgUserId);
  const effectiveRole =
    chat.role === "agent"
      ? chat.role
      : staff.roleOverride ?? (chat.chatType === "private" ? chat.role : staff.linked ? chat.role : null);
  const staffLinked =
    chat.role === "agent" || chat.chatType === "private" ? true : staff.linked;

  const cmd = text.split(/\s+/)[0]?.replace(/@\w+$/, "")?.toLowerCase() ?? "";
  const arg = text.slice(cmd.length).trim();

  if (cmd === "/help") {
    await sendMessage(
      chatId,
      effectiveRole
        ? hermesHelpForRole(effectiveRole)
        : "Link your Telegram user on desk Hermes to unlock commands in this group.",
    );
    return { handled: true, detail: "help" };
  }
  if (cmd === "/status") {
    const prop = store.ensureDemoProperty(chat.propertyId);
    await sendMessage(
      chatId,
      [
        `Property: <b>${prop.name}</b>`,
        `Chat role: <b>${chat.role}</b>`,
        effectiveRole ? `Your role: <b>${effectiveRole}</b>` : "Your role: <i>unlinked</i>",
        `Business date: ${prop.currentBusinessDate}`,
        chat.agentId ? `Agent id: <code>${chat.agentId}</code>` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return { handled: true, detail: "status" };
  }
  if (cmd === "/unpair") {
    chat.status = "revoked";
    chat.revokedAt = new Date().toISOString();
    logEvent(chat.propertyId, chatId, "in", "unpair", {});
    await sendMessage(chatId, "Unpaired. Create a new link on desk to reconnect.");
    return { handled: true, detail: "unpaired_now" };
  }

  if (!effectiveRole) {
    await sendMessage(
      chatId,
      "Staff identity not linked. Ask GM to link your Telegram user on desk Hermes.",
    );
    return { handled: true, detail: "staff_unlinked" };
  }

  const deny = async (cap: string) => {
    await sendMessage(chatId, `Role <b>${effectiveRole}</b> cannot run ${cap}.`);
    return { handled: true, detail: "acl_deny" } as const;
  };

  if (cmd === "/today") {
    if (!canHermes(effectiveRole, "query_today", { staffLinked })) return deny("/today");
    logEvent(chat.propertyId, chatId, "in", "query_today", {});
    await sendMessage(chatId, hermesTodaySummary(chat.propertyId));
    return { handled: true, detail: "today" };
  }
  if (cmd === "/occ") {
    if (!canHermes(effectiveRole, "query_occ", { staffLinked })) return deny("/occ");
    logEvent(chat.propertyId, chatId, "in", "query_occ", {});
    await sendMessage(chatId, hermesOccSummary(chat.propertyId));
    return { handled: true, detail: "occ" };
  }
  if (cmd === "/arrivals") {
    if (!canHermes(effectiveRole, "query_arrivals", { staffLinked })) return deny("/arrivals");
    logEvent(chat.propertyId, chatId, "in", "query_arrivals", {});
    await sendMessage(
      chatId,
      hermesArrivalsSummary(
        chat.propertyId,
        effectiveRole === "agent" ? chat.agentId : null,
      ),
    );
    return { handled: true, detail: "arrivals" };
  }
  if (cmd === "/search") {
    if (!canHermes(effectiveRole, "query_search", { staffLinked })) return deny("/search");
    logEvent(chat.propertyId, chatId, "in", "query_search", { q: arg });
    await sendMessage(chatId, hermesSearchGuests(chat.propertyId, arg));
    return { handled: true, detail: "search" };
  }
  if (cmd === "/clean") {
    if (!canHermes(effectiveRole, "hk_clean", { staffLinked })) return deny("/clean");
    const res = hermesMarkRoomClean(chat.propertyId, arg);
    logEvent(chat.propertyId, chatId, "in", "hk_clean", { room: arg, ok: res.ok });
    await sendMessage(chatId, res.ok ? res.message : res.error);
    return { handled: true, detail: res.ok ? "clean" : "clean_fail" };
  }
  if (cmd === "/covers") {
    if (!canHermes(effectiveRole, "kitchen_covers", { staffLinked })) return deny("/covers");
    logEvent(chat.propertyId, chatId, "in", "kitchen_covers", {});
    await sendMessage(chatId, hermesKitchenCovers(chat.propertyId));
    return { handled: true, detail: "covers" };
  }
  if (cmd === "/audit") {
    if (!canHermes(effectiveRole, "audit_flash", { staffLinked })) return deny("/audit");
    logEvent(chat.propertyId, chatId, "in", "audit_flash", {});
    await sendMessage(chatId, hermesAuditFlash(chat.propertyId));
    return { handled: true, detail: "audit" };
  }

  /* —— Agent MoU-gated —— */
  if (effectiveRole === "agent") {
    if (!chat.agentId) {
      await sendMessage(chatId, "Agent chat missing agentId — re-pair from desk.");
      return { handled: true, detail: "agent_missing_id" };
    }
    const propId = chat.activeMouPropertyId ?? chat.propertyId;
    if (cmd === "/mou") {
      const active = agentHasActiveMou(chat.agentId, propId);
      await sendMessage(
        chatId,
        active
          ? `MoU <b>active</b> with property <code>${propId}</code>.`
          : `No active MoU for property <code>${propId}</code>. Propose from Partner Portal.`,
      );
      return { handled: true, detail: "mou" };
    }
    if (cmd === "/hotel") {
      const code = arg.trim();
      if (!code) {
        await sendMessage(chatId, `Active hotel: <code>${propId}</code>`);
        return { handled: true, detail: "hotel_show" };
      }
      const hit = store.mouLinks.find(
        (m) =>
          m.agentId === chat.agentId &&
          m.status === "active" &&
          (m.propertyId === code || m.propertyId.startsWith(code)),
      );
      if (!hit) {
        await sendMessage(chatId, "No active MoU for that hotel code.");
        return { handled: true, detail: "hotel_deny" };
      }
      chat.activeMouPropertyId = hit.propertyId;
      chat.propertyId = hit.propertyId;
      await sendMessage(chatId, `Active hotel set to <code>${hit.propertyId}</code>.`);
      return { handled: true, detail: "hotel_set" };
    }
    if (!agentHasActiveMou(chat.agentId, propId)) {
      await sendMessage(
        chatId,
        "Blocked — no <b>active MoU</b> with this hotel. Start or accept MoU first.",
      );
      return { handled: true, detail: "mou_gate" };
    }
    if (cmd === "/inventory") {
      if (!canHermes(effectiveRole, "agent_inventory", { staffLinked })) return deny("/inventory");
      logEvent(propId, chatId, "in", "agent_inventory", { agentId: chat.agentId });
      await sendMessage(chatId, hermesInventoryForProperty(propId));
      return { handled: true, detail: "inventory" };
    }
    if (cmd === "/quote" || cmd === "/book" || cmd === "/my" || cmd === "/change") {
      await sendMessage(
        chatId,
        [
          `<b>${cmd}</b> received for MoU hotel <code>${propId}</code>.`,
          "Desk Partner Portal owns full book / change UX; Hermes queues a structured request.",
          cmd === "/book"
            ? "Use /partner Book tab for multi-room holds (held until desk confirm)."
            : "Desk will review change requests from the Agents dossier.",
        ].join("\n"),
      );
      logEvent(propId, chatId, "in", `agent_${cmd.slice(1)}`, { arg, agentId: chat.agentId });
      return { handled: true, detail: `agent_${cmd.slice(1)}` };
    }
  }

  return { handled: false, detail: "not_command" };
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
): Promise<{ handled: boolean; detail?: string }> {
  if (rememberUpdateId(update.update_id)) {
    return { handled: true, detail: "deduped" };
  }

  const cb = update.callback_query;
  if (cb?.data && cb.message?.chat.id != null) {
    const chatId = cb.message.chat.id;
    await answerCallbackQuery(cb.id);
    if (cb.data === "noop") {
      return { handled: true, detail: "noop" };
    }
    const m = cb.data.match(/^attach:([0-9a-f-]{36})$/i);
    if (!m) return { handled: true, detail: "unknown_callback" };
    const bookingId = m[1]!;
    const pending = store.hermesPendingAttach.get(String(chatId));
    if (!pending || pending.expiresAt < Date.now()) {
      await sendMessage(chatId, "Attach expired — send the photo again.");
      return { handled: true, detail: "attach_expired" };
    }
    const draft = store.telegramDocDrafts.find((d) => d.id === pending.draftId);
    if (!draft || draft.status !== "pending") {
      await sendMessage(chatId, "Draft missing — send the photo again.");
      return { handled: true, detail: "draft_missing" };
    }
    const applied = applyOcrToBooking({
      propertyId: pending.propertyId,
      bookingId,
      ocr: draft.ocr,
      asCompanion: pending.asCompanion,
    });
    if (!applied.ok) {
      await sendMessage(chatId, `Could not apply: ${applied.error}`);
      return { handled: true, detail: applied.error };
    }
    draft.status = "applied";
    draft.appliedStayId = bookingId;
    draft.appliedAt = new Date().toISOString();
    store.hermesPendingAttach.delete(String(chatId));
    logEvent(pending.propertyId, chatId, "in", "doc_applied", {
      bookingId,
      draftId: draft.id,
      asCompanion: pending.asCompanion,
    });
    await sendMessage(
      chatId,
      `Saved to <b>${applied.guestName}</b> (${applied.roomLabel}).\nOpen Guests &amp; Docs on desk to review.`,
    );
    return { handled: true, detail: "applied" };
  }

  const msg = update.message;
  if (!msg?.chat?.id) return { handled: false, detail: "no_message" };
  const chatId = msg.chat.id;
  const text = msg.text?.trim() ?? "";
  const displayName =
    msg.from?.first_name || msg.chat.title || msg.chat.username || null;

  const pairToken = parseStartPair(text);
  if (pairToken) {
    await handlePair(chatId, pairToken, displayName, msg.chat.type);
    return { handled: true, detail: "paired" };
  }

  const chat = activeChat(chatId);
  if (!chat) {
    if (text.startsWith("/start") || text.startsWith("/help")) {
      await sendMessage(
        chatId,
        "Not paired yet. Open desk <b>Hermes → Chats</b> and scan the pair link.",
      );
    }
    return { handled: true, detail: "unpaired" };
  }
  chat.lastSeenAt = new Date().toISOString();

  if (text.startsWith("/")) {
    const res = await handleTextCommand(chatId, text, msg.from?.id);
    if (res.handled) return res;
  }

  const photos = msg.photo;
  if (photos?.length) {
    const staff = resolveStaffLinked(chat.propertyId, msg.from?.id);
    const role =
      chat.role === "agent"
        ? null
        : staff.roleOverride ?? (chat.chatType === "private" ? chat.role : null);
    if (!role || !canHermes(role, "doc_ocr", { staffLinked: true })) {
      await sendMessage(chatId, "OCR attach is FO/manager only on linked chats.");
      return { handled: true, detail: "ocr_acl_deny" };
    }

    const best = photos[photos.length - 1]!;
    const file = await getFileBase64(best.file_id);
    const caption = (msg.caption ?? "").toLowerCase();
    const asCompanion = /\bcompanion\b|\+\s*2\b|sharing\b/.test(caption);
    const hintKind: "passport" | "sdf" | undefined = /\bsdf\b/.test(caption)
      ? "sdf"
      : /\bpassport\b|\bcid\b/.test(caption)
        ? "passport"
        : undefined;

    let ocrResult =
      file.ok
        ? await ocrIdentityOrSdf({
            mime: file.mime,
            dataBase64: file.dataBase64,
            hintKind,
            simulate: !process.env.GEMINI_API_KEY && process.env.NODE_ENV !== "production",
          })
        : { ok: false as const, error: file.error };

    if (!ocrResult.ok && process.env.HERMES_OCR_SIMULATE === "1") {
      ocrResult = await ocrIdentityOrSdf({
        mime: "image/jpeg",
        dataBase64: "",
        hintKind,
        simulate: true,
      });
    }

    if (!ocrResult.ok) {
      await sendMessage(chatId, `OCR failed: ${ocrResult.error}`);
      logEvent(chat.propertyId, chatId, "in", "ocr_failed", { error: ocrResult.error });
      return { handled: true, detail: "ocr_failed" };
    }

    const draft: TelegramDocDraftRow = {
      id: randomUUID(),
      propertyId: chat.propertyId,
      kind: ocrResult.ocr.kind,
      status: "pending",
      ocr: ocrResult.ocr,
      imageRef: best.file_id,
      suggestedStayId: null,
      appliedStayId: null,
      createdByChatId: chatId,
      createdAt: new Date().toISOString(),
      appliedAt: null,
    };
    store.telegramDocDrafts.unshift(draft);
    store.hermesPendingAttach.set(String(chatId), {
      draftId: draft.id,
      propertyId: chat.propertyId,
      chatId,
      asCompanion,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    logEvent(chat.propertyId, chatId, "in", "doc_ocr", {
      draftId: draft.id,
      kind: draft.kind,
      asCompanion,
    });

    const summary = [
      `<b>${draft.kind === "sdf" ? "SDF" : "Passport / CID"}</b> read`,
      draft.ocr.fullName ? `Name: <b>${draft.ocr.fullName}</b>` : null,
      draft.ocr.passportOrCid ? `ID: <code>${draft.ocr.passportOrCid}</code>` : null,
      draft.ocr.nationality ? `Nat: ${draft.ocr.nationality}` : null,
      draft.ocr.sdfRef ? `SDF: <code>${draft.ocr.sdfRef}</code>` : null,
      asCompanion ? "<i>Will attach as companion</i>" : "<i>Will attach as primary</i>",
      "",
      "Tap a room:",
    ]
      .filter(Boolean)
      .join("\n");

    await sendMessage(chatId, summary, {
      inline_keyboard: roomChoices(chat.propertyId),
    });
    return { handled: true, detail: "ocr_pending_attach" };
  }

  if (text) {
    await sendMessage(chatId, "Unknown command — try /help.");
  }
  return { handled: true, detail: "text_nudge" };
}
