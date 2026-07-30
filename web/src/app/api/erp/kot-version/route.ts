import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Canonical KOT live-refresh fingerprint. `DeskLiveRefresh` polls this path.
 *
 * (The legacy route file lives at `api/erp/cot-version`; this alias is the
 * correct name and keeps both old and new clients working — no rename of the
 * file is required.)
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
          "id, kot_status, status, order_source, created_at, posted_to_folio_at, is_parked, parked_at, voided_at, settled_at, table_id, total_btn",
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

  const openish = (orders ?? []).filter(
    (o) =>
      o.voided_at == null &&
      (Boolean(o.is_parked) ||
        ["new", "preparing", "ready", "served"].includes(
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
    online: openish.filter(
      (o) => (o.order_source as string | null) === "public",
    ).length,
  });
}
