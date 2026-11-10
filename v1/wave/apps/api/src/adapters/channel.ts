import type { AdapterCtx } from "./types.js";

/** Channel manager status — real tables: channel_connections + ari_queue. */
export async function getChannelStatus(ctx: AdapterCtx) {
  const { data: rows, error } = await ctx.admin
    .from("channel_connections")
    .select(
      "id, provider, external_property_id, status, api_base_url, last_ari_push_at, last_booking_pull_at, notes",
    )
    .eq("property_id", ctx.jwt.propertyId);
  if (error) throw error;

  const { data: queue, error: qErr } = await ctx.admin
    .from("ari_queue")
    .select("id, kind, status, attempts, last_error, scheduled_for, sent_at, created_at")
    .eq("property_id", ctx.jwt.propertyId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (qErr) throw qErr;

  const connections = (rows ?? []).map((c) => {
    const push = c.last_ari_push_at as string | null;
    const pull = c.last_booking_pull_at as string | null;
    return {
      ...c,
      channel: c.provider,
      last_sync_at: [push, pull].filter(Boolean).sort().pop() ?? null,
    };
  });

  return {
    connections,
    ariQueue: (queue ?? []).map((q) => ({ ...q, error: q.last_error })),
  };
}

export async function listRatePlans(ctx: AdapterCtx) {
  const { data, error } = await ctx.admin
    .from("rate_plans")
    .select(
      "id, code, name, room_type_id, season_kind, rate_tier, base_amount_btn, active, notes",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .order("name");
  if (error) throw error;
  return {
    ratePlans: (data ?? []).map((p) => ({ ...p, is_active: p.active })),
  };
}
