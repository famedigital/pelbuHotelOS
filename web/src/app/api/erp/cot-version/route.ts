import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight fingerprint of open / parked / settling KOT tickets for desk
 * live refresh. Includes park, void, settle, and tender fingerprints so the
 * POS open-tickets drawer and kitchen board stay in sync without a full reload.
 */
export async function GET() {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [{ data: orders, error }, { data: tenders }, { data: voids }] =
    await Promise.all([
      admin
        .from("orders")
        .select(
          "id, kot_status, status, created_at, posted_to_folio_at, is_parked, parked_at, voided_at, settled_at, table_id, total_btn",
        )
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("order_tenders")
        .select("id, order_id, amount_btn, method, created_at")
        .order("created_at", { ascending: false })
        .limit(80),
      admin
        .from("pos_voids")
        .select("id, order_id, amount_btn, created_at")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  if (error) {
    console.error("kot-version query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // Match POS open board: unsettled + unvoided kitchen path (incl. served unpaid).
  const openish = (orders ?? []).filter(
    (o) =>
      o.voided_at == null &&
      o.settled_at == null &&
      (Boolean(o.is_parked) ||
        ["new", "preparing", "ready", "served", "cancelled"].includes(
          o.kot_status as string,
        )),
  );

  const version = createHash("sha256")
    .update(
      JSON.stringify({
        orders: openish,
        tenders: tenders ?? [],
        voids: voids ?? [],
      }),
    )
    .digest("hex")
    .slice(0, 20);

  return NextResponse.json({
    version,
    count: openish.length,
    parked: openish.filter((o) => o.is_parked).length,
  });
}
