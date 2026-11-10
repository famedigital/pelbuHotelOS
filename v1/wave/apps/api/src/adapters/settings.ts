import type { AdapterCtx } from "./types.js";

/**
 * Property settings + satellite read models.
 * Real tables: properties, property_ai_settings (gemini_api_key_enc is
 * AES-GCM ciphertext — never return it), property_sequences,
 * guest_loyalty_accounts, property_compliance_documents/categories,
 * laundry_orders (+ laundry_order_items).
 */
export async function getPropertySettings(ctx: AdapterCtx) {
  const [property, ai, sequences] = await Promise.all([
    ctx.admin
      .from("properties")
      .select(
        "id, name, legal_name, slug, timezone, phone, email, address, tax_id, gst_enabled, gst_rate, service_charge_rate, service_charge_default_on, current_business_date, night_audit_close_time, doc_prefix, hotel_code",
      )
      .eq("id", ctx.jwt.propertyId)
      .maybeSingle(),
    ctx.admin
      .from("property_ai_settings")
      .select("gemini_model, enabled, gemini_api_key_enc, updated_at")
      .eq("property_id", ctx.jwt.propertyId)
      .maybeSingle(),
    ctx.admin
      .from("property_sequences")
      .select("kind, last_value, updated_at")
      .eq("property_id", ctx.jwt.propertyId),
  ]);
  if (property.error) throw property.error;
  if (ai.error) throw ai.error;
  if (sequences.error) throw sequences.error;

  const prefix = (property.data?.doc_prefix as string | null) ?? null;
  return {
    property: property.data,
    ai: ai.data
      ? {
          provider: "gemini",
          model: ai.data.gemini_model,
          isEnabled: Boolean(ai.data.enabled),
          hasApiKey: Boolean(ai.data.gemini_api_key_enc),
          updatedAt: ai.data.updated_at,
        }
      : null,
    sequences: (sequences.data ?? []).map((s) => ({ ...s, prefix })),
  };
}

export async function listLoyalty(ctx: AdapterCtx) {
  const { data, error } = await ctx.admin
    .from("guest_loyalty_accounts")
    .select("id, display_name, contact_phone, contact_email, points_balance, tier, updated_at")
    .eq("property_id", ctx.jwt.propertyId)
    .order("points_balance", { ascending: false })
    .limit(200);
  if (error) throw error;
  return {
    members: (data ?? []).map((m) => ({
      ...m,
      guest_name: m.display_name || m.contact_phone,
      phone: m.contact_phone,
      points: m.points_balance,
    })),
  };
}

export async function listCompliance(ctx: AdapterCtx) {
  const { data, error } = await ctx.admin
    .from("property_compliance_documents")
    .select(
      "id, title, file_name, valid_from, valid_until, notes, uploaded_at, property_compliance_categories(code, name)",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .order("valid_until", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw error;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
  const soon = new Date(Date.now() + 30 * 86400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Thimphu",
  });
  return {
    items: (data ?? []).map((d) => {
      const catRaw = d.property_compliance_categories as unknown;
      const cat = (Array.isArray(catRaw) ? catRaw[0] : catRaw) as
        | { code?: string; name?: string }
        | null;
      const until = (d.valid_until as string | null)?.slice(0, 10) ?? null;
      const status = !until
        ? "no_expiry"
        : until < today
          ? "expired"
          : until <= soon
            ? "expiring"
            : "valid";
      return {
        id: d.id,
        title: d.title,
        kind: cat?.name ?? cat?.code ?? "Document",
        due_at: until,
        status,
        notes: d.notes,
        file_name: d.file_name,
      };
    }),
  };
}

export async function listLaundry(ctx: AdapterCtx) {
  const { data, error } = await ctx.admin
    .from("laundry_orders")
    .select(
      "id, booking_id, guest_name, room_label_snapshot, source, status, total_btn, requested_at, ready_at, delivered_at, billed_at, laundry_order_items(requested_qty, confirmed_qty)",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .order("requested_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return {
    tickets: (data ?? []).map((o) => {
      const items = (o.laundry_order_items ?? []) as Array<{
        requested_qty: number | null;
        confirmed_qty: number | null;
      }>;
      const pieces = items.reduce(
        (s, i) => s + Number(i.confirmed_qty ?? i.requested_qty ?? 0),
        0,
      );
      return {
        id: o.id,
        booking_id: o.booking_id,
        guest_name: o.guest_name
          ? `${o.guest_name}${o.room_label_snapshot ? ` · Rm ${o.room_label_snapshot}` : ""}`
          : o.room_label_snapshot,
        status: o.status,
        piece_count: pieces,
        total_btn: o.total_btn,
        created_at: o.requested_at,
        billed: Boolean(o.billed_at),
      };
    }),
  };
}
