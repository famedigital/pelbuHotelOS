import "server-only";

import { computeMealCovers, type MealCoverGuest } from "@/lib/kitchen/covers";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MealPeriod = "breakfast" | "lunch" | "dinner";

export type KitchenMealService = {
  id: string;
  serviceDate: string;
  mealPeriod: MealPeriod;
  heads: number;
  menuNote: string | null;
  menuHighlights: string | null;
  publishedAt: string;
  publishedBy: string | null;
  guestFeed: Array<{
    bookingId: string;
    guestName: string;
    rooms: string;
    adults: number;
    mealPlanCode: string;
  }>;
};

function guestFeedForPeriod(
  guests: MealCoverGuest[],
  period: MealPeriod,
): KitchenMealService["guestFeed"] {
  return guests
    .filter((g) => g.inclusions[period])
    .map((g) => ({
      bookingId: g.bookingId,
      guestName: g.guestName,
      rooms: g.rooms,
      adults: g.adults,
      mealPlanCode: g.mealPlanCode,
    }));
}

function headsForPeriod(
  covers: Awaited<ReturnType<typeof computeMealCovers>>,
  period: MealPeriod,
): number {
  return covers[period];
}

/**
 * Publish (upsert) a meal period for FO / F&B desk: heads, guest feed, menu notes.
 */
export async function publishMealService(
  admin: Admin,
  propertyId: string,
  args: {
    serviceDate: string;
    mealPeriod: MealPeriod;
    menuNote?: string | null;
    menuHighlights?: string | null;
    publishedBy?: string | null;
  },
): Promise<KitchenMealService> {
  const covers = await computeMealCovers(admin, propertyId, args.serviceDate);
  const guestFeed = guestFeedForPeriod(covers.guests, args.mealPeriod);
  const heads = headsForPeriod(covers, args.mealPeriod);

  const row = {
    property_id: propertyId,
    service_date: args.serviceDate,
    meal_period: args.mealPeriod,
    heads,
    guest_feed: guestFeed,
    menu_note: args.menuNote?.trim() || null,
    menu_highlights: args.menuHighlights?.trim() || null,
    published_at: new Date().toISOString(),
    published_by: args.publishedBy?.trim() || null,
  };

  const { data, error } = await admin
    .from("kitchen_meal_services")
    .upsert(row, { onConflict: "property_id,service_date,meal_period" })
    .select(
      "id, service_date, meal_period, heads, guest_feed, menu_note, menu_highlights, published_at, published_by",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not publish meal service.");
  }

  return mapServiceRow(data);
}

export async function loadMealServicesForDate(
  admin: Admin,
  propertyId: string,
  serviceDate: string,
): Promise<KitchenMealService[]> {
  const { data, error } = await admin
    .from("kitchen_meal_services")
    .select(
      "id, service_date, meal_period, heads, guest_feed, menu_note, menu_highlights, published_at, published_by",
    )
    .eq("property_id", propertyId)
    .eq("service_date", serviceDate)
    .order("meal_period");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapServiceRow);
}

function mapServiceRow(row: Record<string, unknown>): KitchenMealService {
  const feed = Array.isArray(row.guest_feed) ? row.guest_feed : [];
  return {
    id: row.id as string,
    serviceDate: row.service_date as string,
    mealPeriod: row.meal_period as MealPeriod,
    heads: Number(row.heads ?? 0),
    menuNote: (row.menu_note as string | null) ?? null,
    menuHighlights: (row.menu_highlights as string | null) ?? null,
    publishedAt: row.published_at as string,
    publishedBy: (row.published_by as string | null) ?? null,
    guestFeed: feed.map((g) => {
      const item = g as Record<string, unknown>;
      return {
        bookingId: String(item.bookingId ?? ""),
        guestName: String(item.guestName ?? "Guest"),
        rooms: String(item.rooms ?? ""),
        adults: Number(item.adults ?? 0),
        mealPlanCode: String(item.mealPlanCode ?? "EP"),
      };
    }),
  };
}
