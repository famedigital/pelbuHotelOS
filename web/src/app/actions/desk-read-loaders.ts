"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import type { FoTodaySnapshot } from "@/lib/erp/fo-today";
import { loadFoTodaySnapshot } from "@/lib/erp/fo-today";
import {
  loadOpenPosTickets,
  loadSettledPosTickets,
  type OpenPosTicket,
} from "@/lib/pos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PosTicketsSnapshot = {
  ok: true;
  propertyId: string;
  openTickets: OpenPosTicket[];
  settledTickets: OpenPosTicket[];
};

export type PosTicketsSnapshotFail = { ok: false; error: string };

/** Slim POS ticket refresh for live patch (no full RSC). */
export async function fetchPosTicketsSnapshot(): Promise<
  PosTicketsSnapshot | PosTicketsSnapshotFail
> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Unauthorized" };
  }
  try {
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const [openTickets, settledTickets] = await Promise.all([
      loadOpenPosTickets(admin),
      loadSettledPosTickets(admin),
    ]);
    return { ok: true, propertyId, openTickets, settledTickets };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load tickets",
    };
  }
}

export type FoTodaySnapshotResult =
  | { ok: true; data: FoTodaySnapshot }
  | { ok: false; error: string };

/** Patch Today board without full layout RSC when fingerprint changes. */
export async function fetchFoTodaySnapshot(): Promise<FoTodaySnapshotResult> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Unauthorized" };
  }
  try {
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const data = await loadFoTodaySnapshot(admin, propertyId);
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load Today",
    };
  }
}

export type ReservationsListSlim = {
  ok: true;
  propertyId: string;
  bucket: string;
  rows: {
    id: string;
    confirmation_code: string | null;
    contact_name: string | null;
    check_in: string;
    check_out: string;
    status: string;
    source: string | null;
  }[];
};

/** Slim reservations fingerprint for cache-first desk list. */
export async function fetchReservationsListSlim(args?: {
  bucket?: string;
  limit?: number;
}): Promise<ReservationsListSlim | { ok: false; error: string }> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Unauthorized" };
  }
  try {
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const bucket = args?.bucket ?? "all";
    const limit = Math.min(args?.limit ?? 250, 1000);
    const { data, error } = await admin
      .from("bookings")
      .select(
        "id, confirmation_code, contact_name, check_in, check_out, status, source",
      )
      .eq("property_id", propertyId)
      .order("check_in", { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      propertyId,
      bucket,
      rows: (data ?? []).map((r) => ({
        id: r.id as string,
        confirmation_code: (r.confirmation_code as string | null) ?? null,
        contact_name: (r.contact_name as string | null) ?? null,
        check_in: r.check_in as string,
        check_out: r.check_out as string,
        status: r.status as string,
        source: (r.source as string | null) ?? null,
      })),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load reservations",
    };
  }
}
