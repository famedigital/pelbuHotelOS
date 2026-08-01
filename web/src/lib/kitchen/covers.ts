import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MealCovers = {
  breakfast: number;
  lunch: number;
  dinner: number;
  eventCovers: number;
};

/**
 * In-house meal covers from checked-in bookings + kitchen events for a date.
 * BB → breakfast; MAP → breakfast + lunch; AP → all three meals.
 */
export async function computeMealCovers(
  admin: Admin,
  propertyId: string,
  businessDate: string,
): Promise<MealCovers> {
  const { data: bookings } = await admin
    .from("bookings")
    .select("adults, meal_plan_code, status")
    .eq("property_id", propertyId)
    .lte("check_in", businessDate)
    .gt("check_out", businessDate)
    .in("status", ["checked_in", "confirmed"]);

  let breakfast = 0;
  let lunch = 0;
  let dinner = 0;

  for (const b of bookings ?? []) {
    const adults = Number(b.adults ?? 1);
    const plan = ((b.meal_plan_code as string) ?? "EP").toUpperCase();
    if (plan === "EP") continue;
    if (plan === "BB") {
      breakfast += adults;
    } else if (plan === "MAP") {
      breakfast += adults;
      lunch += adults;
    } else if (plan === "AP") {
      breakfast += adults;
      lunch += adults;
      dinner += adults;
    } else {
      breakfast += adults;
    }
  }

  const { data: events } = await admin
    .from("kitchen_events")
    .select("covers, meal_period")
    .eq("property_id", propertyId)
    .eq("event_date", businessDate);

  let eventCovers = 0;
  for (const ev of events ?? []) {
    const covers = Number(ev.covers ?? 0);
    eventCovers += covers;
    const period = ev.meal_period as string;
    if (period === "breakfast") breakfast += covers;
    else if (period === "lunch") lunch += covers;
    else if (period === "dinner") dinner += covers;
    else {
      breakfast += covers;
      lunch += covers;
      dinner += covers;
    }
  }

  return { breakfast, lunch, dinner, eventCovers };
}
