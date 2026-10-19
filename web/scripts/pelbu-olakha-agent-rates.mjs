/**
 * Load docs/rate-agent.html agent CP nets onto pelbu-olakha (agents tier).
 * room_rates stores the CP package (room + breakfast) as amount_btn /
 * amount_single_btn — same figures as the downloadable agent rate card.
 * MAP packages stay on the HTML card; FO can use custom/agreed for MAP.
 *
 * Incl. 10% S.C. · GST not charged (hotel newly registered).
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/pelbu-olakha-agent-rates.mjs
 */

import { restClient } from "./lib/supabase-rest.mjs";
import { PRACTICE_SLUG, PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";

const DELUXE = ["deluxe_queen", "deluxe_king", "deluxe_twin"];
const SUITE = ["suite"];
const SEASONS = ["peak", "off", "lean"];

/** CP package nets (incl. 10% S.C.). Double = amount_btn, single = amount_single_btn. */
const RATES = {
  deluxe: { double: 3450, single: 3200 },
  suite: { double: 9300, single: 8400 },
};

const db = restClient();
const practice = await db.select(
  `properties?select=id&slug=eq.${PRACTICE_SLUG}`,
);
const rows = await db.select(
  `properties?select=id,slug,name&slug=eq.${PROPERTY_SLUG}`,
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
    throw new Error(`No agent rate row for room type ${room.code}.`);
  }
  for (const season of SEASONS) {
    rateRows.push({
      property_id: property.id,
      room_type_id: room.id,
      season_kind: season,
      rate_tier: "agents",
      amount_btn: card.double,
      amount_single_btn: card.single,
      currency: "BTN",
    });
  }
}

await db.insert(
  "room_rates",
  rateRows,
  "property_id,room_type_id,season_kind,rate_tier",
);

const saved = await db.select(
  `room_rates?select=season_kind,rate_tier,amount_btn,amount_single_btn,room_types(code)&property_id=eq.${property.id}&rate_tier=eq.agents&order=season_kind`,
);
console.log(
  JSON.stringify(
    {
      propertyId: property.id,
      property: property.name,
      agentRates: saved.map((row) => ({
        room: row.room_types?.code,
        season: row.season_kind,
        doubleCp: row.amount_btn,
        singleCp: row.amount_single_btn,
      })),
      download: "web/content/rates/agent-rate-card.html",
    },
    null,
    2,
  ),
);
