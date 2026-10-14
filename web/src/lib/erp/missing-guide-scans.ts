import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MissingGuideScan = {
  bookingId: string;
  guestName: string;
  roomLabel: string | null;
  agentName: string | null;
  checkOut: string;
  status: string;
};

/** Agent stays ticked as signed, with no scan file yet. */
export async function loadMissingGuideScans(
  admin: Admin,
  propertyId: string,
): Promise<MissingGuideScan[]> {
  const { data, error } = await admin
    .from("bookings")
    .select(
      `id, contact_name, check_out, status,
       agents(company_name),
       room_assignments(room_units(label))`,
    )
    .eq("property_id", propertyId)
    .eq("guide_sign_status", "signed")
    .is("guide_sign_photo_public_id", null)
    .not("agent_id", "is", null)
    .in("status", ["checked_in", "checked_out"])
    .order("check_out", { ascending: false })
    .limit(30);
  if (error || !data) return [];

  return data.map((row) => {
    const agentRaw = row.agents as
      | { company_name?: string | null }
      | { company_name?: string | null }[]
      | null;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
    const labels = (
      (row.room_assignments as
        | { room_units?: { label?: string } | { label?: string }[] | null }[]
        | null) ?? []
    )
      .map((assignment) => {
        const unit = assignment.room_units;
        const room = Array.isArray(unit) ? unit[0] : unit;
        return room?.label?.trim() || "";
      })
      .filter(Boolean);
    return {
      bookingId: row.id as string,
      guestName: (row.contact_name as string | null)?.trim() || "Guest",
      roomLabel: labels[0] ?? null,
      agentName: agent?.company_name?.trim() || null,
      checkOut: String(row.check_out ?? "").slice(0, 10),
      status: (row.status as string) ?? "",
    };
  });
}
