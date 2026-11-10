import { addDaysIso } from "@/lib/stay-dates";
import { thimphuToday } from "@/lib/erp-lists";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type TomorrowDeparture = {
  bookingId: string;
  guestName: string;
  roomLabel: string | null;
  agentName: string | null;
  mealPlanCode: string | null;
  guideNumber: string | null;
  folioId: string | null;
  balanceBtn: number;
};

export async function loadTomorrowDepartures(
  admin: Admin,
  propertyId: string,
  businessDate?: string | null,
): Promise<TomorrowDeparture[]> {
  let today = (businessDate ?? "").slice(0, 10);
  if (!today) {
    const { data: property } = await admin
      .from("properties")
      .select("current_business_date")
      .eq("id", propertyId)
      .maybeSingle();
    today =
      (property?.current_business_date as string | null)?.slice(0, 10) ||
      thimphuToday();
  }
  const tomorrow = addDaysIso(today, 1);
  const { data, error } = await admin
    .from("bookings")
    .select(
      `id, contact_name, meal_plan_code, guide_number,
       agents(company_name),
       room_assignments(room_units(label)),
       folios(id, status, folio_lines(id, total_btn, status, reverses_line_id))`,
    )
    .eq("property_id", propertyId)
    .eq("check_out", tomorrow)
    .eq("status", "checked_in")
    .order("contact_name", { ascending: true })
    .limit(80);
  if (error || !data) return [];

  const { netFolioBalance } = await import("@/lib/folio/balance");

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
      .map((a) => {
        const u = a.room_units;
        const unit = Array.isArray(u) ? u[0] : u;
        return unit?.label;
      })
      .filter(Boolean)
      .join(", ");
    const folios = (row.folios as
      | {
          id?: string;
          status?: string;
          folio_lines?: {
            id?: string;
            total_btn?: number;
            status?: string;
            reverses_line_id?: string | null;
          }[];
        }[]
      | null) ?? [];
    const open = folios.find((f) => f.status === "open") ?? folios[0];
    const balance = open
      ? netFolioBalance(
          (open.folio_lines ?? []).map((l, i) => ({
            id: l.id ?? String(i),
            status: l.status ?? "posted",
            total_btn: Number(l.total_btn ?? 0),
            reverses_line_id: l.reverses_line_id ?? null,
          })),
        )
      : 0;
    return {
      bookingId: row.id as string,
      guestName: (row.contact_name as string) || "Guest",
      roomLabel: labels || null,
      agentName: agent?.company_name ?? null,
      mealPlanCode: (row.meal_plan_code as string | null) ?? null,
      guideNumber: (row.guide_number as string | null) ?? null,
      folioId: (open?.id as string | undefined) ?? null,
      balanceBtn: balance,
    };
  });
}
