import "server-only";

import {
  computeMealStayTotalBtn,
  mealPlanHasMoney,
} from "@/lib/meal-plans-calc";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export { computeMealStayTotalBtn, mealPlanHasMoney };

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MealPlanRecord = {
  code: string;
  name: string;
  blurb: string | null;
  amount_btn_per_adult_night: number | null;
  is_active: boolean;
  sort_order: number;
};

export async function loadActiveMealPlans(
  admin: Admin,
  propertyId: string,
): Promise<MealPlanRecord[]> {
  const { data } = await admin
    .from("meal_plans")
    .select("code, name, blurb, amount_btn_per_adult_night, is_active, sort_order")
    .eq("property_id", propertyId)
    .order("sort_order");
  return (data ?? []).map((row) => ({
    code: row.code as string,
    name: row.name as string,
    blurb: (row.blurb as string | null) ?? null,
    amount_btn_per_adult_night:
      row.amount_btn_per_adult_night == null
        ? null
        : Number(row.amount_btn_per_adult_night),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
  }));
}

export async function resolveMealPlanForBook(
  admin: Admin,
  propertyId: string,
  requestedCode: string | null | undefined,
): Promise<{ code: string; amountPerAdultNight: number | null; name: string }> {
  const code = (requestedCode ?? "").trim() || "EP";

  const { data: plan } = await admin
    .from("meal_plans")
    .select("code, name, amount_btn_per_adult_night, is_active")
    .eq("property_id", propertyId)
    .eq("code", code)
    .maybeSingle();

  if (plan?.is_active) {
    return {
      code: plan.code as string,
      name: plan.name as string,
      amountPerAdultNight:
        plan.amount_btn_per_adult_night == null
          ? null
          : Number(plan.amount_btn_per_adult_night),
    };
  }

  const { data: fallback } = await admin
    .from("meal_plans")
    .select("code, name, amount_btn_per_adult_night")
    .eq("property_id", propertyId)
    .eq("code", "EP")
    .maybeSingle();

  return {
    code: (fallback?.code as string) ?? "EP",
    name: (fallback?.name as string) ?? "Room only",
    amountPerAdultNight:
      fallback?.amount_btn_per_adult_night == null
        ? 0
        : Number(fallback.amount_btn_per_adult_night),
  };
}

export async function loadPropertyDefaultMealPlanCode(
  admin: Admin,
  propertyId: string,
): Promise<string> {
  const { data } = await admin
    .from("properties")
    .select("default_meal_plan_code")
    .eq("id", propertyId)
    .maybeSingle();
  return (data?.default_meal_plan_code as string | undefined)?.trim() || "EP";
}
