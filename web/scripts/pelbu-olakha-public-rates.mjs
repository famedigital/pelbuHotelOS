/**
 * Load docs/rate-public.html (final 2026 rack) onto pelbu-olakha only.
 * room_rates stores all-in EPAI. Meal plans are the per-person add-on
 * so CPAI / MAPAI / APAI = EPAI + plan × occupancy.
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/pelbu-olakha-public-rates.mjs
 */

import { restClient } from "./lib/supabase-rest.mjs";
import { PRACTICE_SLUG, PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";

const DELUXE = ["deluxe_queen", "deluxe_king", "deluxe_twin"];
const SUITE = ["suite"];

/** All-in EPAI. Double = amount_btn, single = amount_single_btn. */
const RATES = {
  deluxe: {
    peak: { double: 6500, single: 6100 },
    off: { double: 5700, single: 5300 },
    lean: { double: 6100, single: 5700 },
  },
  suite: {
    peak: { double: 15800, single: 14900 },
    off: { double: 13800, single: 12900 },
    lean: { double: 14800, single: 13900 },
  },
};

const MEALS = [
  {
    code: "EP",
    name: "Room only",
    blurb: "EPAI — accommodation without meals. The room rate is already all-in.",
    amount_btn_per_adult_night: 0,
    amount_btn_per_child_night: null,
    is_active: true,
    sort_order: 10,
  },
  {
    code: "BB",
    name: "Breakfast (CP)",
    blurb: "CPAI — room plus breakfast. Nu. 500 per adult, Nu. 250 per child (6–12).",
    amount_btn_per_adult_night: 500,
    amount_btn_per_child_night: 250,
    is_active: true,
    sort_order: 20,
  },
  {
    code: "MAP",
    name: "Breakfast and dinner",
    blurb: "MAPAI — room plus breakfast and dinner. Nu. 1,200 per adult, Nu. 650 per child (6–12).",
    amount_btn_per_adult_night: 1200,
    amount_btn_per_child_night: 650,
    is_active: true,
    sort_order: 30,
  },
  {
    code: "AP",
    name: "Full board",
    blurb: "APAI — room plus breakfast, lunch and dinner. Nu. 1,900 per adult, Nu. 1,000 per child (6–12).",
    amount_btn_per_adult_night: 1900,
    amount_btn_per_child_night: 1000,
    is_active: true,
    sort_order: 40,
  },
];

const db = restClient();
const practice = await db.select(
  `properties?select=id&slug=eq.${PRACTICE_SLUG}`,
);
const rows = await db.select(
  `properties?select=id,slug&slug=eq.${PROPERTY_SLUG}`,
);
const property = rows[0];
if (!property || property.slug !== PROPERTY_SLUG) {
  throw new Error(`Property ${PROPERTY_SLUG} was not found.`);
}
if (practice[0]?.id === property.id) {
  throw new Error("Refusing to write rates on the practice hotel.");
}

const types = await db.select(
  `room_types?select=id,code,inventory_kind&property_id=eq.${property.id}`,
);
const sellable = types.filter((row) => row.inventory_kind === "sellable_guest");
const rateRows = [];
for (const room of sellable) {
  const card = SUITE.includes(room.code)
    ? RATES.suite
    : DELUXE.includes(room.code)
      ? RATES.deluxe
      : null;
  if (!card) {
    throw new Error(`No public rack row for room type ${room.code}.`);
  }
  for (const season of ["peak", "off", "lean"]) {
    rateRows.push({
      property_id: property.id,
      room_type_id: room.id,
      season_kind: season,
      rate_tier: "public",
      amount_btn: card[season].double,
      amount_single_btn: card[season].single,
      currency: "BTN",
    });
  }
}

await db.insert(
  "room_rates",
  rateRows,
  "property_id,room_type_id,season_kind,rate_tier",
);
await db.insert(
  "meal_plans",
  MEALS.map((plan) => ({ property_id: property.id, ...plan })),
  "property_id,code",
);
await db.insert(
  "property_policies",
  {
    property_id: property.id,
    free_cancel_days: 7,
    no_show_nights: 1,
    extra_bed_rate_btn: 1300,
    extra_bed_active: true,
    rates_inclusive_of_gst_sc: true,
    check_in_time: "14:00",
    check_out_time: "12:00",
    guest_summary:
      "Public rack 2026 for Pelbu Suites Olakha. Package rates are all-in (10% service charge and 5% GST). Free cancellation is 7 days, or 14 days when any night is peak.",
  },
  "property_id",
);

const saved = await db.select(
  `room_rates?select=season_kind,rate_tier,amount_btn,amount_single_btn,room_types(code)&property_id=eq.${property.id}&rate_tier=eq.public&order=season_kind`,
);
console.log(
  JSON.stringify(
    {
      propertyId: property.id,
      publicRates: saved.map((row) => ({
        room: row.room_types?.code,
        season: row.season_kind,
        double: row.amount_btn,
        single: row.amount_single_btn,
      })),
    },
    null,
    2,
  ),
);
