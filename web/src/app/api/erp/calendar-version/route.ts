import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Fingerprint of room assignments + blocks for calendar live refresh. */
export async function GET() {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [{ data: assignments, error: assignError }, { data: blocks, error: blockError }] =
    await Promise.all([
      admin
        .from("room_assignments")
        .select("id, booking_id, room_unit_id, from_date, to_date, is_locked")
        .eq("property_id", propertyId)
        .order("from_date", { ascending: false })
        .limit(500),
      admin
        .from("room_blocks")
        .select("id, room_unit_id, block_kind, from_date, to_date, released_at")
        .eq("property_id", propertyId)
        .is("released_at", null)
        .order("from_date", { ascending: false })
        .limit(200),
    ]);

  if (assignError || blockError) {
    console.error("calendar-version query failed", assignError ?? blockError);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const version = createHash("sha256")
    .update(JSON.stringify({ assignments: assignments ?? [], blocks: blocks ?? [] }))
    .digest("hex")
    .slice(0, 20);

  return NextResponse.json({
    version,
    assignments: (assignments ?? []).length,
    blocks: (blocks ?? []).length,
  });
}
