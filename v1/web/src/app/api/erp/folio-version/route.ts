import { folioVersionFingerprint } from "@/lib/folio/version-fingerprint";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight folio fingerprint for dual-desk stale detection. */
export async function GET(request: Request) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folioId = new URL(request.url).searchParams.get("id")?.trim();
  if (!folioId) {
    return NextResponse.json({ error: "Missing folio id" }, { status: 400 });
  }

  const propertyId = await requireDeskPropertyId();
  const admin = createSupabaseAdminClient();

  const { data: folio } = await admin
    .from("folios")
    .select("id, property_id, status")
    .eq("id", folioId)
    .maybeSingle();

  if (!folio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    assertDeskProperty(propertyId, folio.property_id as string, "Folio");
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: lines } = await admin
    .from("folio_lines")
    .select("status, total_btn, created_at")
    .eq("folio_id", folioId)
    .order("created_at", { ascending: false })
    .limit(500);

  const version = folioVersionFingerprint({
    status: folio.status as string,
    lines: (lines ?? []) as { status: string; total_btn: number; created_at: string }[],
  });

  return NextResponse.json({ version, lineCount: (lines ?? []).length });
}
