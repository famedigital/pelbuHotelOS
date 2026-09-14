import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Light fingerprint for FO boards — counts + status buckets + max timestamps
 * from columns that exist (bookings/assignments have no updated_at).
 * Protects Vercel Hobby invocations + Supabase egress on 15s polls.
 */
export async function GET() {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuToday();

  const [bookingsRes, assignmentsRes, unitsRes, hkRes] = await Promise.all([
    admin
      .from("bookings")
      .select(
        "id, status, check_in, check_out, guide_number, payment_mode, created_at, checked_in_at, checked_out_at",
      )
      .eq("property_id", propertyId)
      .in("status", [
        "pending",
        "confirmed",
        "checked_in",
        "held",
        "checked_out",
      ])
      .or(
        `check_in.eq.${today},check_out.eq.${today},and(check_in.lte.${today},check_out.gt.${today})`,
      )
      .limit(400),
    admin
      .from("room_assignments")
      .select("id, booking_id, room_unit_id, from_date, to_date, is_locked, locked_at")
      .eq("property_id", propertyId)
      .lte("from_date", today)
      .gt("to_date", today)
      .limit(500),
    admin
      .from("room_units")
      .select("id, hk_status, label, service_requested_at, updated_at")
      .eq("property_id", propertyId)
      .order("label")
      .limit(300),
    admin
      .from("hk_assignments")
      .select(
        "id, room_unit_id, staff_id, status, business_date, created_at, completed_at",
      )
      .eq("property_id", propertyId)
      .eq("business_date", today)
      .limit(200),
  ]);

  if (
    bookingsRes.error ||
    assignmentsRes.error ||
    unitsRes.error ||
    hkRes.error
  ) {
    console.error(
      "front-desk-version query failed",
      bookingsRes.error ??
        assignmentsRes.error ??
        unitsRes.error ??
        hkRes.error,
    );
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const bookings = bookingsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const units = unitsRes.data ?? [];
  const hkAssignments = hkRes.data ?? [];

  const maxIso = (values: Array<string | null | undefined>) => {
    let max = 0;
    for (const v of values) {
      if (!v) continue;
      const t = Date.parse(v);
      if (t > max) max = t;
    }
    return max;
  };

  const statusCounts = (rows: { status?: string | null }[]) => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const s = r.status ?? "_";
      map[s] = (map[s] ?? 0) + 1;
    }
    return map;
  };

  const hkStatusCounts = (rows: { hk_status?: string | null }[]) => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const s = r.hk_status ?? "_";
      map[s] = (map[s] ?? 0) + 1;
    }
    return map;
  };

  // Compact fingerprint — not full JSON of every row.
  const fingerprint = {
    bN: bookings.length,
    bSt: statusCounts(bookings),
    bMax: maxIso(
      bookings.flatMap((b) => [
        b.created_at as string | null,
        b.checked_in_at as string | null,
        b.checked_out_at as string | null,
      ]),
    ),
    bSig: bookings
      .map(
        (b) =>
          `${b.id}:${b.status}:${b.check_in}:${b.check_out}:${b.guide_number ?? ""}:${b.payment_mode ?? ""}`,
      )
      .sort()
      .join("|"),
    aN: assignments.length,
    aLock: assignments.filter((a) => a.is_locked).length,
    aMax: maxIso(assignments.map((a) => a.locked_at as string | null)),
    aSig: assignments
      .map(
        (a) =>
          `${a.id}:${a.booking_id}:${a.room_unit_id}:${a.from_date}:${a.to_date}:${a.is_locked ? 1 : 0}`,
      )
      .sort()
      .join("|"),
    uN: units.length,
    uHk: hkStatusCounts(units),
    uMax: maxIso(
      units.flatMap((u) => [
        u.updated_at as string | null,
        u.service_requested_at as string | null,
      ]),
    ),
    hN: hkAssignments.length,
    hSt: statusCounts(hkAssignments),
    hMax: maxIso(
      hkAssignments.flatMap((h) => [
        h.created_at as string | null,
        h.completed_at as string | null,
      ]),
    ),
    hSig: hkAssignments
      .map(
        (h) =>
          `${h.id}:${h.room_unit_id}:${h.staff_id ?? ""}:${h.status}:${h.completed_at ?? ""}`,
      )
      .sort()
      .join("|"),
  };

  const version = createHash("sha256")
    .update(JSON.stringify(fingerprint))
    .digest("hex")
    .slice(0, 32);

  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
