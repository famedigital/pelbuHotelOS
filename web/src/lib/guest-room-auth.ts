/**
 * In-house guest room verification for public menu ordering.
 * Privacy: public APIs never expose guest names, phones, or booking IDs.
 * Only room labels appear; binding uses room + phone match + short-lived HMAC token.
 */
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  digitsOnly,
  phonesMatch,
} from "@/lib/guest-room-phone";
import { pelbuPropertyId } from "@/lib/rates";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const GENERIC_VERIFY_FAIL =
  "Room or mobile number did not match an active stay. Check the room number and the phone on your booking.";

export type GuestRoomSession = {
  bookingId: string;
  roomUnitId: string;
  roomLabel: string;
  propertyId: string;
  /** Last 4 digits only — never full phone in token payload after issue. */
  phoneHint: string;
  exp: number;
};

function tokenSecret(): string {
  const secret =
    process.env.GUEST_ROOM_TOKEN_SECRET?.trim() ||
    process.env.DESK_PIN?.trim() ||
    process.env.POS_MANAGER_PIN?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret || secret.length < 8) {
    throw new Error("Guest room verification is not configured.");
  }
  return secret;
}

export { digitsOnly, phonesMatch } from "@/lib/guest-room-phone";

function signBody(body: string): string {
  return createHmac("sha256", tokenSecret()).update(body).digest("base64url");
}

export function sealGuestRoomSession(session: GuestRoomSession): string {
  const body = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  return `${body}.${signBody(body)}`;
}

export function openGuestRoomSession(token: string): GuestRoomSession | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = signBody(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const session = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as GuestRoomSession;
    if (
      !session?.bookingId ||
      !session?.roomUnitId ||
      !session?.roomLabel ||
      !session?.propertyId ||
      !session?.exp
    ) {
      return null;
    }
    if (Date.now() > Number(session.exp)) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Public: labels only for currently checked-in sellable guest rooms.
 * Sorted; de-duplicated; never includes guest PII.
 */
export async function listInHouseRoomLabels(
  admin: Admin,
): Promise<string[]> {
  const propertyId = await pelbuPropertyId(admin);

  const { data: bookings } = await admin
    .from("bookings")
    .select("id")
    .eq("property_id", propertyId)
    .eq("status", "checked_in");

  const bookingIds = (bookings ?? []).map((b) => b.id as string);
  if (bookingIds.length === 0) return [];

  const { data: assignments } = await admin
    .from("room_assignments")
    .select(
      "booking_id, room_units(label, room_types(inventory_kind))",
    )
    .eq("property_id", propertyId)
    .in("booking_id", bookingIds);

  const labels = new Set<string>();
  for (const row of assignments ?? []) {
    const unit = row.room_units as
      | {
          label?: string | null;
          room_types?:
            | { inventory_kind?: string | null }
            | { inventory_kind?: string | null }[]
            | null;
        }
      | {
          label?: string | null;
          room_types?:
            | { inventory_kind?: string | null }
            | { inventory_kind?: string | null }[]
            | null;
        }[]
      | null;
    const u = Array.isArray(unit) ? unit[0] : unit;
    if (!u?.label) continue;
    const rt = u.room_types;
    const kind = Array.isArray(rt)
      ? rt[0]?.inventory_kind
      : rt?.inventory_kind;
    // Only sellable guest rooms on the public picker (no guide/driver/staff beds).
    if (kind && kind !== "sellable_guest") continue;
    labels.add(String(u.label).trim());
  }

  return [...labels].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

/**
 * Verify room label + booking phone. Returns session for charge-to-room.
 * Always use GENERIC_VERIFY_FAIL to the client on failure (no enum of occupancy).
 */
export async function verifyInHouseRoomAndPhone(
  admin: Admin,
  roomLabel: string,
  phone: string,
): Promise<
  | { ok: true; session: GuestRoomSession; token: string }
  | { ok: false; error: string }
> {
  const label = roomLabel.trim();
  const phoneDigits = digitsOnly(phone);
  if (!label || phoneDigits.length < 7) {
    return { ok: false, error: GENERIC_VERIFY_FAIL };
  }

  const propertyId = await pelbuPropertyId(admin);

  const { data: units } = await admin
    .from("room_units")
    .select("id, label, room_types(inventory_kind)")
    .eq("property_id", propertyId);

  const matchUnit = (units ?? []).find(
    (u) => String(u.label ?? "").trim().toLowerCase() === label.toLowerCase(),
  );
  if (!matchUnit) {
    return { ok: false, error: GENERIC_VERIFY_FAIL };
  }

  const rt = matchUnit.room_types as
    | { inventory_kind?: string | null }
    | { inventory_kind?: string | null }[]
    | null;
  const kind = Array.isArray(rt) ? rt[0]?.inventory_kind : rt?.inventory_kind;
  if (kind && kind !== "sellable_guest") {
    return { ok: false, error: GENERIC_VERIFY_FAIL };
  }

  const unitId = matchUnit.id as string;

  const { data: assignment } = await admin
    .from("room_assignments")
    .select("booking_id, bookings!inner(id, status, contact_phone, property_id)")
    .eq("property_id", propertyId)
    .eq("room_unit_id", unitId)
    .eq("bookings.status", "checked_in")
    .eq("bookings.property_id", propertyId)
    .order("from_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assignment?.booking_id) {
    return { ok: false, error: GENERIC_VERIFY_FAIL };
  }

  const booking = assignment.bookings as
    | {
        id?: string;
        status?: string;
        contact_phone?: string | null;
        property_id?: string;
      }
    | {
        id?: string;
        status?: string;
        contact_phone?: string | null;
        property_id?: string;
      }[]
    | null;

  const b = Array.isArray(booking) ? booking[0] : booking;
  if (!b?.id || b.status !== "checked_in") {
    return { ok: false, error: GENERIC_VERIFY_FAIL };
  }

  if (!phonesMatch(phone, String(b.contact_phone ?? ""))) {
    return { ok: false, error: GENERIC_VERIFY_FAIL };
  }

  const session: GuestRoomSession = {
    bookingId: b.id as string,
    roomUnitId: unitId,
    roomLabel: String(matchUnit.label).trim(),
    propertyId,
    phoneHint: phoneDigits.slice(-4),
    exp: Date.now() + TOKEN_TTL_MS,
  };

  return { ok: true, session, token: sealGuestRoomSession(session) };
}

/**
 * Re-check session still valid (booking still checked in, assignment still holds).
 */
export async function assertActiveGuestRoomSession(
  admin: Admin,
  session: GuestRoomSession,
): Promise<boolean> {
  if (Date.now() > session.exp) return false;

  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, contact_phone")
    .eq("id", session.bookingId)
    .eq("property_id", session.propertyId)
    .maybeSingle();

  if (!booking || (booking.status as string) !== "checked_in") return false;

  const { data: assignment } = await admin
    .from("room_assignments")
    .select("id")
    .eq("property_id", session.propertyId)
    .eq("booking_id", session.bookingId)
    .eq("room_unit_id", session.roomUnitId)
    .maybeSingle();

  return Boolean(assignment);
}

export {
  GENERIC_VERIFY_FAIL as GUEST_ROOM_VERIFY_FAIL_MESSAGE,
  TOKEN_TTL_MS as GUEST_ROOM_TOKEN_TTL_MS,
};
