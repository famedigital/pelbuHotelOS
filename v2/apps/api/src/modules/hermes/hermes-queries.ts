/**
 * Tenant-safe Hermes read models — always filter by propertyId.
 * Never cross property boundaries (H-iso regression).
 */
import { store } from "../../platform/memory-store.js";

function bizDate(propertyId: string): string {
  return (
    store.properties.get(propertyId)?.currentBusinessDate ??
    new Date().toISOString().slice(0, 10)
  );
}

function roomLabel(propertyId: string, roomId: string | null | undefined): string {
  if (!roomId) return "—";
  return store.rooms.find((r) => r.id === roomId && r.propertyId === propertyId)?.number ?? "—";
}

export function assertSameProperty(
  propertyId: string,
  otherPropertyId: string,
): boolean {
  return propertyId === otherPropertyId;
}

export function hermesTodaySummary(propertyId: string): string {
  const day = bizDate(propertyId);
  const bookings = store.bookings.filter((b) => b.propertyId === propertyId);
  const arrivals = bookings.filter(
    (b) =>
      b.checkIn === day &&
      !["cancelled", "no_show", "checked_out"].includes(b.status),
  );
  const inHouse = bookings.filter((b) => b.status === "checked_in");
  const departures = bookings.filter(
    (b) => b.checkOut === day && b.status === "checked_in",
  );
  const lines = [
    `<b>Today · ${day}</b>`,
    `Arrivals: <b>${arrivals.length}</b>`,
    `In-house: <b>${inHouse.length}</b>`,
    `Due out: <b>${departures.length}</b>`,
    "",
    ...arrivals.slice(0, 8).map((b) => {
      const room =
        b.lines
          .map((l) => roomLabel(propertyId, l.roomId))
          .find((n) => n !== "—") ?? "TBA";
      return `· ${room} · ${escapeHtml(b.guestName)} · ${b.status}`;
    }),
  ];
  if (arrivals.length === 0) lines.push("<i>No arrivals listed</i>");
  return lines.join("\n");
}

export function hermesOccSummary(propertyId: string): string {
  const day = bizDate(propertyId);
  const rooms = store.rooms.filter((r) => r.propertyId === propertyId && r.hkStatus !== "ooo");
  const occupied = rooms.filter((r) =>
    store.bookings.some(
      (b) =>
        b.propertyId === propertyId &&
        b.status === "checked_in" &&
        b.lines.some((l) => l.roomId === r.id),
    ),
  ).length;
  const dirty = rooms.filter((r) => r.hkStatus === "dirty" || r.hkStatus === "inspect").length;
  const pct = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;
  return [
    `<b>Occupancy · ${day}</b>`,
    `Sellable rooms: <b>${rooms.length}</b>`,
    `Occupied: <b>${occupied}</b> (${pct}%)`,
    `Dirty / inspect: <b>${dirty}</b>`,
  ].join("\n");
}

export function hermesArrivalsSummary(propertyId: string, agentId?: string | null): string {
  const day = bizDate(propertyId);
  let bookings = store.bookings.filter(
    (b) =>
      b.propertyId === propertyId &&
      b.checkIn === day &&
      !["cancelled", "no_show"].includes(b.status),
  );
  if (agentId) {
    bookings = bookings.filter(
      (b) => (b as { agentId?: string | null }).agentId === agentId || b.source === "agent",
    );
  }
  if (!bookings.length) return `<b>Arrivals · ${day}</b>\n<i>None</i>`;
  return [
    `<b>Arrivals · ${day}</b>`,
    ...bookings.slice(0, 12).map((b) => `· ${escapeHtml(b.guestName)} · ${b.status}`),
  ].join("\n");
}

export function hermesSearchGuests(propertyId: string, q: string): string {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return "Search needs at least 2 characters.";
  const hits = store.bookings.filter(
    (b) =>
      b.propertyId === propertyId &&
      !["cancelled", "no_show"].includes(b.status) &&
      b.guestName.toLowerCase().includes(needle),
  );
  if (!hits.length) return `No guests matching <code>${escapeHtml(q)}</code> at this hotel.`;
  return [
    `<b>Search · ${escapeHtml(q)}</b>`,
    ...hits.slice(0, 10).map((b) => {
      const room =
        b.lines
          .map((l) => roomLabel(propertyId, l.roomId))
          .find((n) => n !== "—") ?? "—";
      return `· ${room} · ${escapeHtml(b.guestName)} · ${b.status}`;
    }),
  ].join("\n");
}

export function hermesMarkRoomClean(
  propertyId: string,
  roomNumber: string,
): { ok: true; message: string } | { ok: false; error: string } {
  const room = store.rooms.find(
    (r) =>
      r.propertyId === propertyId &&
      r.number.toLowerCase() === roomNumber.trim().toLowerCase(),
  );
  if (!room) return { ok: false, error: `Room ${roomNumber} not found at this hotel` };
  room.hkStatus = "clean";
  return { ok: true, message: `Room <b>${room.number}</b> marked clean.` };
}

export function hermesKitchenCovers(propertyId: string): string {
  const day = bizDate(propertyId);
  const inHouse = store.bookings.filter(
    (b) => b.propertyId === propertyId && b.status === "checked_in",
  );
  const pax = inHouse.reduce((n, b) => n + Math.max(1, b.lines.length * 2), 0);
  return [
    `<b>Kitchen covers · ${day}</b>`,
    `In-house stays: <b>${inHouse.length}</b>`,
    `Approx pax: <b>${pax}</b>`,
    "<i>Print Studio kitchen pass has diets + MAP detail</i>",
  ].join("\n");
}

export function hermesAuditFlash(propertyId: string): string {
  const day = bizDate(propertyId);
  const prop = store.properties.get(propertyId);
  const rooms = store.rooms.filter((r) => r.propertyId === propertyId);
  const inHouse = store.bookings.filter(
    (b) => b.propertyId === propertyId && b.status === "checked_in",
  ).length;
  return [
    `<b>Manager flash · ${day}</b>`,
    `Property: ${escapeHtml(prop?.name ?? propertyId)}`,
    `In-house: <b>${inHouse}</b> / ${rooms.length} rooms`,
    "Night audit: run from desk Night Audit — Hermes is read-only here.",
  ].join("\n");
}

export function hermesInventoryForProperty(propertyId: string): string {
  const day = bizDate(propertyId);
  const types = new Map<string, { name: string; total: number; busy: number }>();
  for (const rt of store.roomTypes.filter((t) => t.propertyId === propertyId)) {
    types.set(rt.id, { name: rt.name, total: 0, busy: 0 });
  }
  for (const r of store.rooms.filter((x) => x.propertyId === propertyId && x.hkStatus !== "ooo")) {
    const row = types.get(r.roomTypeId);
    if (!row) continue;
    row.total += 1;
    const occupied = store.bookings.some(
      (b) =>
        b.propertyId === propertyId &&
        !["cancelled", "no_show", "checked_out"].includes(b.status) &&
        b.checkIn <= day &&
        day < b.checkOut &&
        b.lines.some((l) => l.roomId === r.id),
    );
    if (occupied) row.busy += 1;
  }
  const lines = [`<b>Inventory · ${day}</b>`];
  for (const row of types.values()) {
    lines.push(`· ${escapeHtml(row.name)}: <b>${Math.max(0, row.total - row.busy)}</b> sellable / ${row.total}`);
  }
  if (lines.length === 1) lines.push("<i>No room types seeded</i>");
  return lines.join("\n");
}

export function agentHasActiveMou(agentId: string, propertyId: string): boolean {
  return store.mouLinks.some(
    (m) =>
      m.agentId === agentId &&
      m.propertyId === propertyId &&
      m.status === "active",
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
