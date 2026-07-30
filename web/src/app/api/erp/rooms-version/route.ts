import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Fingerprint of room categories + physical units for settings live refresh. */
export async function GET() {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [{ data: types, error: typeError }, { data: units, error: unitError }] =
    await Promise.all([
      admin
        .from("room_types")
        .select("id, code, name, inventory_kind, unit_count")
        .eq("property_id", propertyId)
        .order("code"),
      admin
        .from("room_units")
        .select("id, room_type_id, label, floor_label, notes, hk_status, sort_order")
        .eq("property_id", propertyId)
        .order("sort_order")
        .order("label"),
    ]);

  if (typeError || unitError) {
    console.error("rooms-version query failed", typeError ?? unitError);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const version = createHash("sha256")
    .update(JSON.stringify({ types: types ?? [], units: units ?? [] }))
    .digest("hex")
    .slice(0, 20);

  return NextResponse.json({
    version,
    roomTypes: (types ?? []).length,
    roomUnits: (units ?? []).length,
  });
}
