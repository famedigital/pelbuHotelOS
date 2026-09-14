"use server";

import {
  GUEST_ROOM_VERIFY_FAIL_MESSAGE,
  listInHouseRoomLabels,
  openGuestRoomSession,
  verifyInHouseRoomAndPhone,
  type GuestRoomSession,
} from "@/lib/guest-room-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertPhone, optionalTrim, trimRequired } from "@/lib/validation";
import { headers } from "next/headers";

export type InHouseRoomsState = {
  ok: boolean;
  rooms?: string[];
  error?: string;
};

export type VerifyGuestRoomState = {
  ok: boolean;
  token?: string;
  roomLabel?: string;
  /** Last 4 of verified phone only — never full phone or guest name. */
  phoneHint?: string;
  error?: string;
};

/** Public: room numbers only for currently checked-in sellable rooms. */
export async function fetchInHouseRoomLabels(): Promise<InHouseRoomsState> {
  try {
    const h = await headers();
    const rl = await rateLimit(`inhouse-rooms:${clientIp(h)}`, {
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (!rl.ok) {
      return { ok: false, error: "Too many requests. Try again later." };
    }
    const admin = createSupabaseAdminClient();
    const rooms = await listInHouseRoomLabels(admin);
    return { ok: true, rooms };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load rooms.",
    };
  }
}

/**
 * Room + booking phone. Never returns guest name. Token is opaque HMAC.
 */
export async function verifyGuestRoomForOrder(
  _prev: VerifyGuestRoomState,
  formData: FormData,
): Promise<VerifyGuestRoomState> {
  try {
    const h = await headers();
    const ip = clientIp(h);
    const rl = await rateLimit(`inhouse-verify:${ip}`, {
      limit: 12,
      windowMs: 60 * 60_000,
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: "Too many verification attempts. Wait and try again, or call the desk.",
      };
    }

    const roomLabel = trimRequired(formData.get("room_label"), "Room number");
    const phone = trimRequired(formData.get("phone"), "Mobile number");
    assertPhone(phone);

    const roomRl = await rateLimit(
      `inhouse-verify-room:${roomLabel.toLowerCase()}:${ip}`,
      { limit: 8, windowMs: 60 * 60_000 },
    );
    if (!roomRl.ok) {
      return { ok: false, error: GUEST_ROOM_VERIFY_FAIL_MESSAGE };
    }

    const admin = createSupabaseAdminClient();
    const result = await verifyInHouseRoomAndPhone(admin, roomLabel, phone);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      token: result.token,
      roomLabel: result.session.roomLabel,
      phoneHint: result.session.phoneHint,
    };
  } catch (e) {
    // Collapse validation noise into generic fail where possible
    if (e instanceof Error && /phone/i.test(e.message)) {
      return { ok: false, error: GUEST_ROOM_VERIFY_FAIL_MESSAGE };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : GUEST_ROOM_VERIFY_FAIL_MESSAGE,
    };
  }
}

/** Peek a sealed token for UI (room label only). */
export async function peekGuestRoomToken(
  tokenRaw: string | null | undefined,
): Promise<{ ok: true; roomLabel: string } | { ok: false }> {
  const token = optionalTrim(tokenRaw ?? null);
  if (!token) return { ok: false };
  const session = openGuestRoomSession(token);
  if (!session) return { ok: false };
  return { ok: true, roomLabel: session.roomLabel };
}

export type { GuestRoomSession };
