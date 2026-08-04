import "server-only";

import {
  computeExtraBedStayTotalBtn,
  computeMealStayTotalBtn,
  extraBedIsSellable,
  mealPlanHasMoney,
  MAX_CHILDREN,
  MAX_EXTRA_BEDS,
} from "@/lib/meal-plans-calc";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export {
  computeExtraBedStayTotalBtn,
  computeMealStayTotalBtn,
  extraBedIsSellable,
  mealPlanHasMoney,
  MAX_CHILDREN,
  MAX_EXTRA_BEDS,
};

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MealPlanRecord = {
  code: string;
  name: string;
  blurb: string | null;
  amount_btn_per_adult_night: number | null;
  amount_btn_per_child_night: number | null;
  is_active: boolean;
  sort_order: number;
};

export type ExtraBedPolicy = {
  ratePerNight: number | null;
  active: boolean;
  sellable: boolean;
};

export async function loadActiveMealPlans(
  admin: Admin,
  propertyId: string,
): Promise<MealPlanRecord[]> {
  const { data } = await admin
    .from("meal_plans")
    .select(
      "code, name, blurb, amount_btn_per_adult_night, amount_btn_per_child_night, is_active, sort_order",
    )
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
    amount_btn_per_child_night:
      row.amount_btn_per_child_night == null
        ? null
        : Number(row.amount_btn_per_child_night),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
  }));
}

export async function resolveMealPlanForBook(
  admin: Admin,
  propertyId: string,
  requestedCode: string | null | undefined,
): Promise<{
  code: string;
  amountPerAdultNight: number | null;
  amountPerChildNight: number | null;
  name: string;
}> {
  const code = (requestedCode ?? "").trim() || "EP";

  const { data: plan } = await admin
    .from("meal_plans")
    .select(
      "code, name, amount_btn_per_adult_night, amount_btn_per_child_night, is_active",
    )
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
      amountPerChildNight:
        plan.amount_btn_per_child_night == null
          ? null
          : Number(plan.amount_btn_per_child_night),
    };
  }

  const { data: fallback } = await admin
    .from("meal_plans")
    .select(
      "code, name, amount_btn_per_adult_night, amount_btn_per_child_night",
    )
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
    amountPerChildNight:
      fallback?.amount_btn_per_child_night == null
        ? null
        : Number(fallback.amount_btn_per_child_night),
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

export async function loadExtraBedPolicy(
  admin: Admin,
  propertyId: string,
): Promise<ExtraBedPolicy> {
  const { data } = await admin
    .from("property_policies")
    .select("extra_bed_rate_btn, extra_bed_active")
    .eq("property_id", propertyId)
    .maybeSingle();
  const ratePerNight =
    data?.extra_bed_rate_btn == null ? null : Number(data.extra_bed_rate_btn);
  const active = Boolean(data?.extra_bed_active);
  return {
    ratePerNight,
    active,
    sellable: extraBedIsSellable(active, ratePerNight),
  };
}

/** Resolve meal + extra bed totals from form pax for a stay window. */
export async function resolveStayAddonsForBook(
  admin: Admin,
  propertyId: string,
  args: {
    mealPlanCode: string | null | undefined;
    adults: number;
    children: number;
    extraBeds: number;
    nights: number;
  },
): Promise<{
  mealPlanCode: string;
  mealPlanAmountBtn: number;
  amountPerChildNight: number | null;
  childrenUnpriced: boolean;
  extraBeds: number;
  extraBedAmountBtn: number;
}> {
  const mealResolved = await resolveMealPlanForBook(
    admin,
    propertyId,
    args.mealPlanCode,
  );
  const mealPlanAmountBtn =
    computeMealStayTotalBtn(
      mealResolved.amountPerAdultNight,
      args.adults,
      args.nights,
      mealResolved.amountPerChildNight,
      args.children,
    ) ?? 0;

  // Blank child rate now auto-fills at 50% of adult (child package 6–12).
  // True unpriced only when meal plan is label-only but children were entered.
  const childrenUnpriced =
    args.children > 0 &&
    mealResolved.amountPerAdultNight == null;

  const extraPolicy = await loadExtraBedPolicy(admin, propertyId);
  let extraBeds = Math.max(
    0,
    Math.min(MAX_EXTRA_BEDS, Math.floor(args.extraBeds)),
  );
  let extraBedAmountBtn = 0;
  if (extraPolicy.sellable && extraBeds > 0) {
    extraBedAmountBtn = computeExtraBedStayTotalBtn(
      extraPolicy.ratePerNight,
      extraBeds,
      args.nights,
    );
  } else {
    extraBeds = 0;
  }

  return {
    mealPlanCode: mealResolved.code,
    mealPlanAmountBtn,
    amountPerChildNight: mealResolved.amountPerChildNight,
    childrenUnpriced,
    extraBeds,
    extraBedAmountBtn,
  };
}
