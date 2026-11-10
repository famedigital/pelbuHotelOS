import type { SupabaseClient } from "@supabase/supabase-js";

/** In-house sellable rooms attributed to agent (room assignments still open). */
export async function countAgentOpenRooms(
  admin: SupabaseClient,
  args: { propertyId: string; agentId: string; excludeBookingId?: string | null },
): Promise<number> {
  const { data: bookings, error } = await admin
    .from("bookings")
    .select("id, rooms")
    .eq("property_id", args.propertyId)
    .eq("agent_id", args.agentId)
    .eq("status", "checked_in");
  if (error) throw new Error(error.message);

  let total = 0;
  for (const b of bookings ?? []) {
    if (args.excludeBookingId && b.id === args.excludeBookingId) continue;
    const rooms = Number(b.rooms ?? 1);
    total += Number.isFinite(rooms) && rooms > 0 ? rooms : 1;
  }
  return total;
}

export function agentRoomCapBlockedMessage(args: {
  companyName?: string | null;
  openRooms: number;
  incomingRooms: number;
  cap: number;
}): string {
  const who = args.companyName?.trim() || "This agent";
  const after = args.openRooms + args.incomingRooms;
  return (
    `${who} has ${args.openRooms} open room(s) in-house (cap ${args.cap}). ` +
    `This check-in adds ${args.incomingRooms} → ${after}. ` +
    `Clear or check out prior groups, raise open_room_cap on Agents, or tick override with a note.`
  );
}
