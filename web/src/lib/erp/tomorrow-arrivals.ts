import { addDaysIso } from "@/lib/stay-dates";
import { thimphuToday } from "@/lib/erp-lists";
import {
  guidePhoneFromPlaceholder,
  isPlaceholderGuideNumber,
} from "@/lib/guide-number";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type TomorrowArrival = {
  bookingId: string;
  guestName: string;
  roomLabel: string | null;
  agentName: string | null;
  agentPhone: string | null;
  agentEmail: string | null;
  mealPlanCode: string | null;
  guideNumber: string | null;
  guideName: string | null;
  guidePhone: string | null;
  guideMissing: boolean;
};

export async function loadTomorrowArrivals(
  admin: Admin,
  propertyId: string,
  businessDate?: string | null,
): Promise<TomorrowArrival[]> {
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
       agents(company_name, contact_phone, contact_email),
       guides(full_name, phone),
       room_assignments(room_units(label))`,
    )
    .eq("property_id", propertyId)
    .eq("check_in", tomorrow)
    .in("status", ["pending", "confirmed"])
    .order("contact_name", { ascending: true })
    .limit(80);
  if (error || !data) return [];

  return data.map((row) => {
    const agentRaw = row.agents as
      | {
          company_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
        }
      | {
          company_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
        }[]
      | null;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
    const guideRaw = row.guides as
      | { full_name?: string | null; phone?: string | null }
      | { full_name?: string | null; phone?: string | null }[]
      | null;
    const guide = Array.isArray(guideRaw) ? guideRaw[0] : guideRaw;
    const stored = (row.guide_number as string | null) ?? null;
    const missing = isPlaceholderGuideNumber(stored);
    const labels = (
      (row.room_assignments as
        | { room_units?: { label?: string } | { label?: string }[] | null }[]
        | null) ?? []
    )
      .map((a) => {
        const unit = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
        return unit?.label?.trim() || "";
      })
      .filter(Boolean);
    return {
      bookingId: row.id as string,
      guestName: ((row.contact_name as string | null) ?? "").trim() || "Guest",
      roomLabel: labels.length ? labels.join(", ") : null,
      agentName: agent?.company_name?.trim() || null,
      agentPhone: agent?.contact_phone?.trim() || null,
      agentEmail: agent?.contact_email?.trim() || null,
      mealPlanCode: (row.meal_plan_code as string | null) ?? null,
      guideNumber: missing ? null : stored,
      guideName: guide?.full_name?.trim() || null,
      guidePhone:
        guide?.phone?.trim() || guidePhoneFromPlaceholder(stored) || null,
      guideMissing: missing,
    };
  });
}
