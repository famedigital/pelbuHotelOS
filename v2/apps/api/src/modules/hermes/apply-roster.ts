import { randomUUID } from "node:crypto";
import {
  getDb,
  updateBookingGuestRosterPersist,
  upsertGuestPersist,
} from "@hos-v2/db";
import { store, type TelegramDocOcr } from "../../platform/memory-store.js";

export function applyOcrToBooking(input: {
  propertyId: string;
  bookingId: string;
  ocr: TelegramDocOcr;
  asCompanion?: boolean;
}):
  | { ok: true; guestName: string; roomLabel: string }
  | { ok: false; error: string } {
  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) return { ok: false, error: "Booking not found" };

  const roomLabel =
    booking.lines
      .map((l) => store.rooms.find((r) => r.id === l.roomId)?.number)
      .find(Boolean) ?? "unassigned";

  if (input.asCompanion) {
    const name = input.ocr.fullName?.trim();
    if (!name) return { ok: false, error: "Companion name missing from OCR" };
    booking.companionName = name;
    booking.companionPassportOrCid = input.ocr.passportOrCid?.trim() || null;
    booking.companionNationality = input.ocr.nationality?.trim() || null;
    void persistCompanion(booking);
    return { ok: true, guestName: `${booking.guestName} + ${name}`, roomLabel };
  }

  const guestName = input.ocr.fullName?.trim() || booking.guestName;
  const passportOrCid = input.ocr.passportOrCid?.trim() || null;
  const nationality = input.ocr.nationality?.trim() || null;

  let guest = booking.guestId
    ? store.guests.find((g) => g.id === booking.guestId)
    : undefined;
  if (guest) {
    guest.fullName = guestName;
    if (passportOrCid) guest.passportOrCid = passportOrCid;
    if (nationality) guest.nationality = nationality;
  } else {
    guest = {
      id: randomUUID(),
      propertyId: input.propertyId,
      fullName: guestName,
      nationality,
      phone: null,
      email: null,
      vip: false,
      passportOrCid,
    };
    store.guests.push(guest);
  }
  booking.guestId = guest.id;
  booking.guestName = guestName;

  if (input.ocr.kind === "sdf" && input.ocr.sdfRef) {
    const tag = `SDF:${input.ocr.sdfRef}`;
    const notes = booking.notes?.trim() ?? "";
    booking.notes = notes.includes(tag) ? notes : [notes, tag].filter(Boolean).join(" · ");
  }

  void persistPrimary(booking, guest);
  return { ok: true, guestName, roomLabel };
}

async function persistPrimary(
  booking: (typeof store.bookings)[number],
  guest: (typeof store.guests)[number],
) {
  const db = getDb();
  if (!db) return;
  await upsertGuestPersist(db, {
    propertyId: booking.propertyId,
    guestId: guest.id,
    fullName: guest.fullName,
    nationality: guest.nationality,
    phone: guest.phone,
    email: guest.email,
    vip: guest.vip,
    passportOrCid: guest.passportOrCid ?? null,
  });
  await updateBookingGuestRosterPersist(db, {
    propertyId: booking.propertyId,
    bookingId: booking.id,
    guestId: guest.id,
    companionName: booking.companionName ?? null,
    companionPassportOrCid: booking.companionPassportOrCid ?? null,
    companionNationality: booking.companionNationality ?? null,
  });
}

async function persistCompanion(booking: (typeof store.bookings)[number]) {
  const db = getDb();
  if (!db) return;
  await updateBookingGuestRosterPersist(db, {
    propertyId: booking.propertyId,
    bookingId: booking.id,
    guestId: booking.guestId,
    companionName: booking.companionName ?? null,
    companionPassportOrCid: booking.companionPassportOrCid ?? null,
    companionNationality: booking.companionNationality ?? null,
  });
}
