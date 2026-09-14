import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PROPERTY_SLUG } from "@/lib/property";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Inbound webhook from Channex (or relay).
 * Requires CHANNEXT_WEBHOOK_SECRET and header `x-channex-secret`.
 * Resolves property via payload property_id → channel_connections.external_property_id,
 * then falls back to flagship slug.
 */
export async function POST(request: Request) {
  const expected =
    process.env.CHANNEX_WEBHOOK_SECRET?.trim() ||
    process.env.CHANNEXT_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Channex webhooks not configured." },
      { status: 503 },
    );
  }
  const got = request.headers.get("x-channex-secret")?.trim();
  if (got !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const doc = body as {
    event?: string;
    data?: {
      id?: string;
      attributes?: Record<string, unknown>;
      relationships?: {
        property?: { data?: { id?: string } };
      };
    };
    id?: string;
    property_id?: string;
  };

  const externalPropertyId =
    (typeof doc.property_id === "string" ? doc.property_id : null) ||
    (typeof doc.data?.attributes?.property_id === "string"
      ? (doc.data.attributes.property_id as string)
      : null) ||
    doc.data?.relationships?.property?.data?.id ||
    null;

  let propertyId: string | null = null;
  let connectionId: string | null = null;

  if (externalPropertyId) {
    const { data: conn } = await admin
      .from("channel_connections")
      .select("id, property_id")
      .eq("provider", "channex")
      .eq("external_property_id", externalPropertyId)
      .maybeSingle();
    if (conn) {
      propertyId = conn.property_id as string;
      connectionId = conn.id as string;
    }
  }

  if (!propertyId) {
    const { data: property } = await admin
      .from("properties")
      .select("id")
      .eq("slug", DEFAULT_PROPERTY_SLUG)
      .single();
    propertyId = (property?.id as string | undefined) ?? null;
    if (propertyId) {
      const { data: conn } = await admin
        .from("channel_connections")
        .select("id")
        .eq("property_id", propertyId)
        .eq("provider", "channex")
        .maybeSingle();
      connectionId = (conn?.id as string | undefined) ?? null;
    }
  }

  if (!propertyId) {
    return NextResponse.json({ error: "Property missing" }, { status: 500 });
  }

  const revId =
    doc.data?.id ??
    doc.id ??
    `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { error } = await admin.from("channel_booking_revisions").upsert(
    {
      property_id: propertyId,
      connection_id: connectionId,
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
