import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MealInclusions = {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
};

export type MealCoverGuest = {
  bookingId: string;
  guestName: string;
  rooms: string;
  adults: number;
  mealPlanCode: string;
  status: string;
  inclusions: MealInclusions;
};

export type MealCovers = {
  breakfast: number;
  lunch: number;
  dinner: number;
  eventCovers: number;
  guests: MealCoverGuest[];
};

/** Standard EP / BB / MAP / AP meal inclusion rules. */
export function mealPlanInclusions(planCode: string): MealInclusions {
  const plan = (planCode ?? "EP").toUpperCase();
  if (plan === "EP") {
    return { breakfast: false, lunch: false, dinner: false };
  }
  if (plan === "BB") {
    return { breakfast: true, lunch: false, dinner: false };
  }
  if (plan === "MAP") {
    return { breakfast: true, lunch: true, dinner: false };
  }
  if (plan === "AP") {
    return { breakfast: true, lunch: true, dinner: true };
  }
  return { breakfast: true, lunch: false, dinner: false };
}

function roomLabels(
  assignments:
    | {
        room_units?: { label?: string } | { label?: string }[] | null;
      }[]
    | null
    | undefined,
): string {
  return (assignments ?? [])
    .map((a) => {
      const unit = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
      return unit?.label;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * In-house meal covers from checked-in bookings + kitchen events for a date.
 * BB → breakfast; MAP → breakfast + lunch; AP → all three meals.
 * Children count toward covers when on a meal plan (priced or free).
 */
export async function computeMealCovers(
  admin: Admin,
  propertyId: string,
  businessDate: string,
): Promise<MealCovers> {
  const { data: bookings } = await admin
    .from("bookings")
    .select(
      `id, contact_name, adults, children, meal_plan_code, status,
       room_assignments(room_units(label))`,
    )
    .eq("property_id", propertyId)
    .lte("check_in", businessDate)
    .gt("check_out", businessDate)
    .in("status", ["checked_in", "confirmed"]);

  let breakfast = 0;
  let lunch = 0;
  let dinner = 0;
  const guests: MealCoverGuest[] = [];

  for (const b of bookings ?? []) {
    const adults = Number(b.adults ?? 1);
    const children = Math.max(0, Number(b.children ?? 0));
    const heads = adults + children;
    const plan = ((b.meal_plan_code as string) ?? "EP").toUpperCase();
    const inclusions = mealPlanInclusions(plan);

    if (inclusions.breakfast) breakfast += heads;
    if (inclusions.lunch) lunch += heads;
    if (inclusions.dinner) dinner += heads;

    if (
      inclusions.breakfast ||
      inclusions.lunch ||
      inclusions.dinner
    ) {
      guests.push({
        bookingId: b.id as string,
        guestName: (b.contact_name as string) ?? "Guest",
        rooms: roomLabels(
          b.room_assignments as
            | { room_units?: { label?: string } | { label?: string }[] | null }[]
            | null,
        ),
        adults: heads,
        mealPlanCode: plan,
        status: (b.status as string) ?? "confirmed",
        inclusions,
      });
    }
  }

  const { data: events } = await admin
    .from("kitchen_events")
    .select("covers, meal_period, status")
    .eq("property_id", propertyId)
    .eq("event_date", businessDate)
    .neq("status", "cancelled");

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

  guests.sort((a, b) => {
    const roomCmp = a.rooms.localeCompare(b.rooms);
    if (roomCmp !== 0) return roomCmp;
    return a.guestName.localeCompare(b.guestName);
  });

  return { breakfast, lunch, dinner, eventCovers, guests };
}
