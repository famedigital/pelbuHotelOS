import { z } from "zod";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";

/** Parties / groups — real tables: booking_groups + booking_group_members. */
export async function listParties(ctx: AdapterCtx) {
  const { data, error } = await ctx.admin
    .from("booking_groups")
    .select(
      `id, name, agent_id, check_in, check_out, status, notes, created_at,
       booking_group_members(booking_id, bookings(id, confirmation_code, contact_name, status, check_in, check_out, rooms))`,
    )
    .eq("property_id", ctx.jwt.propertyId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  return {
    parties: (data ?? []).map((g) => {
      const members = (g.booking_group_members ?? []) as Array<{
        booking_id: string;
        bookings: unknown;
      }>;
      return {
        id: g.id,
        name: g.name,
        agent_id: g.agent_id,
        check_in: g.check_in,
        check_out: g.check_out,
        status: g.status,
        notes: g.notes,
        created_at: g.created_at,
        bookings: members
          .map((m) => (Array.isArray(m.bookings) ? m.bookings[0] : m.bookings))
          .filter(Boolean),
      };
    }),
  };
}

const partySchema = z.object({
  name: z.string().min(1),
  agentId: z.string().uuid().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bookingIds: z.array(z.string().uuid()).default([]),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

export async function createParty(ctx: AdapterCtx, raw: unknown) {
  const input = partySchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  // Only attach bookings that belong to this property.
  let bookingIds: string[] = [];
  if (input.bookingIds.length) {
    const { data: owned, error: oErr } = await ctx.admin
      .from("bookings")
      .select("id")
      .eq("property_id", ctx.jwt.propertyId)
      .in("id", input.bookingIds);
    if (oErr) throw oErr;
    bookingIds = (owned ?? []).map((b) => b.id as string);
    if (bookingIds.length !== input.bookingIds.length) {
      throw new Error("One or more bookings do not belong to this property");
    }
  }

  const { data: group, error } = await ctx.admin
    .from("booking_groups")
    .insert({
      property_id: ctx.jwt.propertyId,
      name: input.name,
      agent_id: input.agentId ?? null,
      check_in: input.checkIn ?? null,
      check_out: input.checkOut ?? null,
      notes: input.notes ?? null,
      status: "open",
    })
    .select("id, name")
    .single();
  if (error) throw error;

  if (bookingIds.length) {
    const { error: mErr } = await ctx.admin
      .from("booking_group_members")
      .insert(bookingIds.map((id) => ({ group_id: group.id, booking_id: id })));
    if (mErr) {
      await ctx.admin.from("booking_groups").delete().eq("id", group.id);
      throw mErr;
    }
  }

  const result = { ok: true, partyId: group.id as string, name: group.name };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "create_party",
    result,
  );
  return result;
}
