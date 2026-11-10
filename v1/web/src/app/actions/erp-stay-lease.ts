"use server";

import { writeAuditEvent } from "@/lib/audit";
import { resolveDeskActor } from "@/lib/desk/actor";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";

const LEASE_TTL_MS = 90_000;

export type StayLeaseState = {
  ok: boolean;
  holding?: boolean;
  peerLabel?: string | null;
  expiresAt?: string | null;
  error?: string;
  message?: string;
};

function leaseExpiryIso(): string {
  return new Date(Date.now() + LEASE_TTL_MS).toISOString();
}

/**
 * Claim or renew a short DB lease on a booking while StayHub is open.
 * Another desk with a live lease surfaces as peerLabel (still forceable).
 */
export async function claimStayLease(
  bookingId: string,
  clientToken: string,
  opts?: { force?: boolean; forceNote?: string | null },
): Promise<StayLeaseState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const id = bookingId.trim();
    const token = clientToken.trim();
    if (!id || !token) return { ok: false, error: "Missing booking or token." };

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const expiresAt = leaseExpiryIso();

    const { data: existing } = await admin
      .from("booking_stay_leases")
      .select("booking_id, client_token, holder_label, expires_at, staff_id")
      .eq("booking_id", id)
      .maybeSingle();

    if (existing) {
      const exp = new Date(existing.expires_at as string).getTime();
      const live = Number.isFinite(exp) && exp > Date.now();
      const sameClient = (existing.client_token as string) === token;
      if (live && sameClient && !opts?.force) {
        await admin
          .from("booking_stay_leases")
          .update({ expires_at: expiresAt })
          .eq("booking_id", id);
        return {
          ok: true,
          holding: true,
          peerLabel: null,
          expiresAt,
        };
      }
      if (live && !sameClient && !opts?.force) {
        return {
          ok: true,
          holding: false,
          peerLabel:
            (existing.holder_label as string) ||
            "Another desk has this stay open",
          expiresAt: existing.expires_at as string,
          message:
            "Another workstation has this stay open. Coordinate money posts, or force with a manager note.",
        };
      }
    }

    const propertyId = await resolveActivePropertyId(admin);
    const { actor, staffId } = await resolveDeskActor();
    const holderLabel = actor === "desk" ? "Desk (PIN)" : actor;

    const { data: booking } = await admin
      .from("bookings")
      .select("id, property_id")
      .eq("id", id)
      .maybeSingle();
    if (!booking) return { ok: false, error: "Booking not found." };
    assertDeskProperty(propertyId, booking.property_id as string, "Booking");

    const forceNote = optionalTrim(opts?.forceNote ?? null);
    const row = {
      booking_id: id,
      property_id: propertyId,
      staff_id: staffId,
      client_token: token,
      holder_label: holderLabel,
      claimed_at: now,
      expires_at: expiresAt,
      force_note: opts?.force ? forceNote : null,
    };

    const { error } = await admin.from("booking_stay_leases").upsert(row, {
      onConflict: "booking_id",
    });
    if (error) throw new Error(error.message);

    if (opts?.force && existing && (existing.client_token as string) !== token) {
      await writeAuditEvent(admin, {
        propertyId,
        action: "stay.lease_force",
        entityType: "bookings",
        entityId: id,
        summary: `Forced stay lease from ${existing.holder_label}`,
        meta: {
          previousClient: existing.client_token,
          note: forceNote,
        },
      });
    }

    return {
      ok: true,
      holding: true,
      peerLabel: null,
      expiresAt,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not claim lease.",
    };
  }
}

export async function releaseStayLease(
  bookingId: string,
  clientToken: string,
): Promise<StayLeaseState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const id = bookingId.trim();
    const token = clientToken.trim();
    if (!id || !token) return { ok: false };

    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin
      .from("booking_stay_leases")
      .select("client_token")
      .eq("booking_id", id)
      .maybeSingle();
    if (!existing || (existing.client_token as string) !== token) {
      return { ok: true, holding: false };
    }
    await admin.from("booking_stay_leases").delete().eq("booking_id", id);
    return { ok: true, holding: false };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not release lease.",
    };
  }
}

/** Peek without claiming — for banner refresh. */
export async function peekStayLease(
  bookingId: string,
  clientToken: string,
): Promise<StayLeaseState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const id = bookingId.trim();
    const token = trimRequired(clientToken, "Token");
    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin
      .from("booking_stay_leases")
      .select("client_token, holder_label, expires_at")
      .eq("booking_id", id)
      .maybeSingle();
    if (!existing) {
      return { ok: true, holding: false, peerLabel: null };
    }
    const exp = new Date(existing.expires_at as string).getTime();
    if (!Number.isFinite(exp) || exp <= Date.now()) {
      return { ok: true, holding: false, peerLabel: null };
    }
    const same = (existing.client_token as string) === token;
    return {
      ok: true,
      holding: same,
      peerLabel: same
        ? null
        : ((existing.holder_label as string) ?? "Another desk"),
      expiresAt: existing.expires_at as string,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Peek failed.",
    };
  }
}
