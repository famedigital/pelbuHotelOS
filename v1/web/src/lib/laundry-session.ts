import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const LAUNDRY_SESSION_COOKIE = "pelbu_laundry_session";

export function hashLaundryToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createLaundryToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function setLaundrySessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const jar = await cookies();
  jar.set(LAUNDRY_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/laundry",
    expires: expiresAt,
  });
}

export type LaundryGuestSession = {
  id: string;
  propertyId: string;
  bookingId: string;
  roomUnitId: string;
  guestName: string;
  expiresAt: string;
};

export async function getLaundryGuestSession(): Promise<LaundryGuestSession | null> {
  const jar = await cookies();
  const token = jar.get(LAUNDRY_SESSION_COOKIE)?.value;
  if (!token) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("laundry_guest_sessions")
    .select(
      "id, property_id, booking_id, room_unit_id, guest_name, expires_at, revoked_at",
    )
    .eq("token_hash", hashLaundryToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  await admin
    .from("laundry_guest_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);
  return {
    id: data.id as string,
    propertyId: data.property_id as string,
    bookingId: data.booking_id as string,
    roomUnitId: data.room_unit_id as string,
    guestName: data.guest_name as string,
    expiresAt: data.expires_at as string,
  };
}

export async function clearLaundrySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(LAUNDRY_SESSION_COOKIE);
}
