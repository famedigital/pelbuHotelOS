import { randomUUID } from "node:crypto";
import {
  store,
  type BookingRow,
  type HermesAlertKind,
  type HermesAlertPref,
  type HermesRole,
} from "../../platform/memory-store.js";
import { sendMessage } from "./bot-api.js";

export const DEFAULT_HERMES_ALERT_PREFS: HermesAlertPref[] = [
  { kind: "guest_check_in", enabled: true, sendAt: null, roles: ["fo", "agent"] },
  { kind: "guest_check_out", enabled: true, sendAt: null, roles: ["fo", "agent"] },
  { kind: "meal_board", enabled: false, sendAt: "06:30", roles: ["kitchen", "fo"] },
  { kind: "invoice_issued", enabled: false, sendAt: null, roles: ["fo", "agent", "manager"] },
  { kind: "hk_dirty", enabled: false, sendAt: null, roles: ["hk", "manager"] },
  { kind: "night_audit", enabled: false, sendAt: null, roles: ["manager", "gm"] },
];

export function getHermesAlertPrefs(propertyId: string): HermesAlertPref[] {
  const existing = store.hermesAlertPrefs.get(propertyId);
  if (existing && existing.length > 0) return existing;
  const seeded = DEFAULT_HERMES_ALERT_PREFS.map((p) => ({ ...p, roles: [...p.roles] }));
  store.hermesAlertPrefs.set(propertyId, seeded);
  return seeded;
}

export function putHermesAlertPrefs(
  propertyId: string,
  prefs: HermesAlertPref[],
): HermesAlertPref[] {
  const next = prefs.map((p) => ({
    ...p,
    roles: [...p.roles],
  }));
  store.hermesAlertPrefs.set(propertyId, next);
  return next;
}

export function prefEnabled(
  prefs: HermesAlertPref[],
  kind: HermesAlertKind,
): HermesAlertPref | null {
  const hit = prefs.find((p) => p.kind === kind);
  if (!hit || !hit.enabled) return null;
  return hit;
}

export function resolveAlertChats(
  propertyId: string,
  pref: HermesAlertPref,
  booking?: BookingRow | null,
): { chatId: number; role: HermesRole }[] {
  const active = store.telegramChats.filter(
    (c) => c.propertyId === propertyId && c.status === "active",
  );
  const out: { chatId: number; role: HermesRole }[] = [];
  const seen = new Set<number>();
  for (const role of pref.roles) {
    for (const chat of active) {
      if (chat.role !== role) continue;
      if (role === "agent" && booking?.agentId) {
        if (chat.agentId && chat.agentId !== booking.agentId) continue;
      }
      if (seen.has(chat.chatId)) continue;
      seen.add(chat.chatId);
      out.push({ chatId: chat.chatId, role: chat.role });
    }
  }
  return out;
}

export function formatStayAlert(
  kind: "guest_check_in" | "guest_check_out",
  booking: BookingRow,
  roomLabel: string,
): string {
  const verb = kind === "guest_check_in" ? "Checked in" : "Checked out";
  return [
    `<b>Innora Bot · ${verb}</b>`,
    `${booking.guestName}`,
    `Rm ${roomLabel || "—"} · ${booking.confirmationNo}`,
    `${booking.checkIn} → ${booking.checkOut}`,
    booking.agencyName ? `Agent: ${booking.agencyName}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export type NotifyStayResult = {
  sent: number;
  skipped: boolean;
  reason?: string;
  eventIds: string[];
};

/** Fire-and-forget safe: never mutates folio; logs events even if Telegram delivery fails. */
export async function notifyStayLifecycleAlert(input: {
  propertyId: string;
  kind: "guest_check_in" | "guest_check_out";
  booking: BookingRow;
}): Promise<NotifyStayResult> {
  const prefs = getHermesAlertPrefs(input.propertyId);
  const pref = prefEnabled(prefs, input.kind);
  if (!pref) {
    return { sent: 0, skipped: true, reason: "pref_disabled", eventIds: [] };
  }
  const roomLabel = input.booking.lines
    .map((l) => {
      const room = store.rooms.find((r) => r.id === l.roomId);
      return room?.number;
    })
    .filter(Boolean)
    .join(", ");
  const text = formatStayAlert(input.kind, input.booking, roomLabel);
  const targets = resolveAlertChats(input.propertyId, pref, input.booking);
  if (targets.length === 0) {
    const eventId = randomUUID();
    store.telegramEvents.unshift({
      id: eventId,
      propertyId: input.propertyId,
      chatId: null,
      direction: "system",
      intent: input.kind,
      kind: "alert",
      status: "ok",
      text,
      latencyMs: null,
      payload: { skipped: true, reason: "no_chats" },
      createdAt: new Date().toISOString(),
    });
    return { sent: 0, skipped: true, reason: "no_chats", eventIds: [eventId] };
  }

  const eventIds: string[] = [];
  let sent = 0;
  for (const t of targets) {
    const started = Date.now();
    const delivery = await sendMessage(t.chatId, text);
    const eventId = randomUUID();
    eventIds.push(eventId);
    store.telegramEvents.unshift({
      id: eventId,
      propertyId: input.propertyId,
      chatId: t.chatId,
      direction: "out",
      intent: input.kind,
      kind: "alert",
      status: delivery.ok ? "ok" : "error",
      text,
      latencyMs: Date.now() - started,
      payload: {
        role: t.role,
        bookingId: input.booking.id,
        delivery: delivery.ok ? "telegram" : "failed",
        error: delivery.ok ? undefined : delivery.error,
      },
      createdAt: new Date().toISOString(),
    });
    if (delivery.ok) sent += 1;
  }
  return { sent, skipped: false, eventIds };
}

export function filterTelegramEvents(input: {
  propertyId: string;
  intent?: string;
  kind?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}) {
  const limit = Math.min(input.limit ?? 50, 100);
  let rows = store.telegramEvents.filter((e) => e.propertyId === input.propertyId);
  if (input.intent) {
    rows = rows.filter((e) => e.intent === input.intent);
  }
  if (input.kind) {
    rows = rows.filter((e) => (e.kind ?? "message") === input.kind);
  }
  if (input.q?.trim()) {
    const q = input.q.trim().toLowerCase();
    rows = rows.filter((e) => {
      const blob = `${e.intent} ${e.text ?? ""} ${JSON.stringify(e.payload)}`.toLowerCase();
      return blob.includes(q);
    });
  }
  let start = 0;
  if (input.cursor) {
    const idx = rows.findIndex((e) => e.id === input.cursor);
    if (idx >= 0) start = idx + 1;
  }
  const slice = rows.slice(start, start + limit);
  const nextCursor =
    start + limit < rows.length ? slice[slice.length - 1]?.id ?? null : null;
  return { events: slice, nextCursor, total: rows.length };
}
