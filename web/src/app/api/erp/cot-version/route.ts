import { isDeskAuthenticated } from "@/lib/desk-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight fingerprint of open KOT tickets for desk live refresh. */
export async function GET() {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, kot_status, status, created_at, posted_to_folio_at")
    .in("kot_status", ["new", "preparing", "ready", "served"])
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("kot-version query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const version = createHash("sha256")
    .update(JSON.stringify(data ?? []))
    .digest("hex")
    .slice(0, 20);

  return NextResponse.json({
    version,
    count: (data ?? []).length,
  });
}
