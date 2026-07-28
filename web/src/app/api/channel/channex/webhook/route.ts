import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Optional inbound webhook from Channex (or relay).
 * Protect with CHANNEXT_WEBHOOK_SECRET header `x-channex-secret` when set.
 * Revisions are stored; desk/cron imports + acks.
 */
export async function POST(request: Request) {
  const expected =
    process.env.CHANNEX_WEBHOOK_SECRET?.trim() ||
    process.env.CHANNEXT_WEBHOOK_SECRET?.trim();
  if (expected) {
    const got = request.headers.get("x-channex-secret")?.trim();
    if (got !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (!property) {
    return NextResponse.json({ error: "Property missing" }, { status: 500 });
  }

  const { data: conn } = await admin
    .from("channel_connections")
    .select("id")
    .eq("property_id", property.id)
    .eq("provider", "channex")
    .maybeSingle();

  const doc = body as {
    event?: string;
    data?: { id?: string; attributes?: Record<string, unknown> };
    id?: string;
  };

  const revId =
    doc.data?.id ??
    doc.id ??
    `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { error } = await admin.from("channel_booking_revisions").upsert(
    {
      property_id: property.id,
      connection_id: conn?.id ?? null,
      external_revision_id: String(revId),
      external_booking_id: doc.data?.attributes?.booking_id
        ? String(doc.data.attributes.booking_id)
        : null,
      revision_type: String(doc.event ?? "new")
        .toLowerCase()
        .includes("cancel")
        ? "cancel"
        : "new",
      payload: body as object,
      status: "received",
    },
    { onConflict: "property_id,external_revision_id" },
  );

  if (error) {
    console.error("webhook revision store failed", error);
    return NextResponse.json({ error: "Store failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revision_id: revId });
}
