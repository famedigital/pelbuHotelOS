import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Fingerprint of active stays, assignments, and HK status for arrivals /
 * check-in / rooms boards so front desk and housekeeping stay in sync.
 */
export async function GET() {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuToday();

  const [
    { data: bookings, error: bookingError },
    { data: assignments, error: assignError },
    { data: units, error: unitError },
  ] = await Promise.all([
    admin
      .from("bookings")
      .select(
        "id, status, check_in, check_out, guide_number, payment_mode, created_at, checked_in_at, checked_out_at",
      )
      .eq("property_id", propertyId)
      .in("status", ["pending", "confirmed", "checked_in", "held"])
      .or(`check_in.eq.${today},check_out.eq.${today},and(check_in.lte.${today},check_out.gt.${today})`)
      .limit(400),
    admin
      .from("room_assignments")
      .select("id, booking_id, room_unit_id, from_date, to_date, is_locked")
      .eq("property_id", propertyId)
      .lte("from_date", today)
      .gt("to_date", today)
      .limit(500),
    admin
      .from("room_units")
      .select("id, hk_status, label")
      .eq("property_id", propertyId)
      .order("label")
      .limit(300),
  ]);

  if (bookingError || assignError || unitError) {
    console.error(
      "front-desk-version query failed",
      bookingError ?? assignError ?? unitError,
    );
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const version = createHash("sha256")
    .update(
      JSON.stringify({
        bookings: bookings ?? [],
        assignments: assignments ?? [],
        units: units ?? [],
      }),
    )
    .digest("hex")
    .slice(0, 20);

  return NextResponse.json({
    version,
    bookings: (bookings ?? []).length,
    assignments: (assignments ?? []).length,
  });
}
