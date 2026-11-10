/**
 * Create the live Pelbu Suites Olakha tenant and property.
 * Does not read or write the practice property pelbu-suites-olakha.
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/pelbu-olakha-provision.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-provision.mjs --workbook="C:/Users/rajiv/Downloads/Pelbu-Olakha-import-2026.xlsx"
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { restClient } from "./lib/supabase-rest.mjs";
import { readZip, rowsFromCells, sharedStrings, sheetCells, workbookSheets } from "./lib/xlsx-lite.mjs";
import {
  PRACTICE_SLUG,
  PROPERTY_NAME,
  PROPERTY_SLUG,
  ROOM_TYPE_META,
  TENANT_SLUG,
  canonicalRooms,
  roomsFromSheetRows,
} from "./lib/pelbu-olakha-rooms.mjs";

function argValue(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

if (PROPERTY_SLUG === PRACTICE_SLUG) {
  console.error("Refusing to provision the practice slug.");
  process.exit(1);
}

const workbookPath =
  argValue("--workbook=") ||
  "C:/Users/rajiv/Downloads/Pelbu-Olakha-import-2026.xlsx";

function roomsFromWorkbook(filePath) {
  if (!existsSync(filePath)) return canonicalRooms();
  const files = readZip(readFileSync(filePath));
  const strings = sharedStrings(
    files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "<sst></sst>",
  );
  const sheet = workbookSheets(files).find((item) => item.name === "Rooms");
  if (!sheet) return canonicalRooms();
  const xml = files.get(sheet.path)?.toString("utf8") ?? "";
  return roomsFromSheetRows(rowsFromCells(sheetCells(xml, strings)));
}

const db = restClient();

const practice = await db.select(
  `properties?select=id,slug&slug=eq.${PRACTICE_SLUG}`,
);
const practiceId = practice[0]?.id ?? null;

const existingTenant = await db.select(
  `tenants?select=id,slug,name&slug=eq.${TENANT_SLUG}`,
);
let tenantId = existingTenant[0]?.id ?? null;
if (!tenantId) {
  const inserted = await db.insert("tenants", {
    name: PROPERTY_NAME,
    slug: TENANT_SLUG,
    plan: "hotel",
    billing_status: "active",
    billing_notes:
      "Live Pelbu Suites Olakha. The practice hotel pelbu-suites is a separate tenant.",
  });
  tenantId = inserted[0].id;
}

const existingProperty = await db.select(
  `properties?select=id,slug,name,tenant_id&slug=eq.${PROPERTY_SLUG}`,
);
let propertyId = existingProperty[0]?.id ?? null;
if (propertyId && propertyId === practiceId) {
  throw new Error("Resolved property id is the practice hotel. Aborting.");
}
if (!propertyId) {
  const inserted = await db.insert("properties", {
    name: PROPERTY_NAME,
    legal_name: PROPERTY_NAME,
    slug: PROPERTY_SLUG,
    timezone: "Asia/Thimphu",
    template_id: 1,
    tenant_id: tenantId,
    is_demo: false,
    setup_step: 5,
    setup_completed_at: new Date().toISOString(),
    default_meal_plan_code: null,
    income_streams: {
      rooms: true,
      outlets: ["cafe", "pastry", "restaurant", "bar"],
      services: ["spa", "meeting", "steam"],
      guest_services: ["taxi", "shop", "other"],
      channel: false,
    },
    bank_accounts: [],
  });
  propertyId = inserted[0].id;
} else if (existingProperty[0].tenant_id !== tenantId) {
  await db.update(`properties?id=eq.${propertyId}`, { tenant_id: tenantId });
}

if (propertyId === practiceId) {
  throw new Error("Refusing to seed the practice property.");
}

const year = Number(
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" }).slice(0, 4),
);
const seasons = [
  { kind: "peak", starts_on: `${year}-03-01`, ends_on: `${year}-05-31` },
  { kind: "lean", starts_on: `${year}-06-01`, ends_on: `${year}-08-31` },
  { kind: "off", starts_on: `${year}-09-01`, ends_on: `${year}-11-30` },
  { kind: "peak", starts_on: `${year}-12-01`, ends_on: `${year + 1}-02-28` },
];
const seasonCount = await db.select(
  `seasons?select=id&property_id=eq.${propertyId}&limit=1`,
);
if (!seasonCount.length) {
  await db.insert(
    "seasons",
    seasons.map((row) => ({ property_id: propertyId, ...row })),
  );
}

const ttl = [
  ["client", "peak", 12],
  ["client", "lean", 48],
  ["client", "off", 168],
  ["agent", "peak", 24],
  ["agent", "lean", 72],
  ["agent", "off", 240],
  ["reservation", "peak", 6],
  ["reservation", "lean", 24],
  ["reservation", "off", 72],
  ["owner", "peak", 6],
  ["owner", "lean", 24],
  ["owner", "off", 72],
  ["ota", "peak", 24],
  ["ota", "lean", 48],
  ["ota", "off", 72],
];
await db.insert(
  "hold_ttl_rules",
  ttl.map(([source, season_kind, ttl_hours]) => ({
    property_id: propertyId,
    source,
    season_kind,
    ttl_hours,
  })),
  "property_id,source,season_kind",
);
await db.insert(
  "property_deposit_rules",
  {
    property_id: propertyId,
    mode: "one_night",
    floor_btn: 2000,
    percent: null,
    bank_hint: "Transfer token · quote booking ID in remarks",
  },
  "property_id",
);
await db.insert(
  "rate_tiers",
  ["public", "friends", "family", "mutual_friends", "agents", "mou_agents"].map(
    (code) => ({ property_id: propertyId, code }),
  ),
  "property_id,code",
);

const mealPlans = [
  {
    code: "EP",
    name: "Room only",
    blurb: "Accommodation without a meal plan.",
    amount_btn_per_adult_night: 0,
    sort_order: 10,
    is_active: true,
  },
  {
    code: "BB",
    name: "Breakfast (CP)",
    blurb: "Continental plan. The rack writes CP; the desk stores it as BB.",
    amount_btn_per_adult_night: null,
    sort_order: 20,
    is_active: true,
  },
  {
    code: "MAP",
    name: "Breakfast and dinner",
    blurb: "Half board. Prices stay on the imported stay note until a rate card is set.",
    amount_btn_per_adult_night: null,
    sort_order: 30,
    is_active: true,
  },
  {
    code: "AP",
    name: "Full board",
    blurb: "Breakfast, lunch and dinner.",
    amount_btn_per_adult_night: null,
    sort_order: 40,
    is_active: false,
  },
];
await db.insert(
  "meal_plans",
  mealPlans.map((plan) => ({ property_id: propertyId, ...plan })),
  "property_id,code",
);
await db.update(`properties?id=eq.${propertyId}&slug=eq.${PROPERTY_SLUG}`, {
  default_meal_plan_code: "EP",
  name: PROPERTY_NAME,
  legal_name: PROPERTY_NAME,
  is_demo: false,
  setup_step: 5,
  setup_completed_at: new Date().toISOString(),
});

const rooms = roomsFromWorkbook(resolve(workbookPath));
const byCategory = new Map();
for (const room of rooms) {
  const list = byCategory.get(room.category) ?? [];
  list.push(room);
  byCategory.set(room.category, list);
}

const typeRows = [];
for (const [code, meta] of Object.entries(ROOM_TYPE_META)) {
  const sellable = byCategory.get(code) ?? [];
  const unitCount =
    meta.inventory_kind === "sellable_guest" ? sellable.length : 2;
  if (meta.inventory_kind === "sellable_guest" && unitCount === 0) continue;
  typeRows.push({
    property_id: propertyId,
    code,
    name: meta.name,
    inventory_kind: meta.inventory_kind,
    unit_count: unitCount,
  });
}
await db.insert("room_types", typeRows, "property_id,code");
const types = await db.select(
  `room_types?select=id,code&property_id=eq.${propertyId}`,
);
const typeId = new Map(types.map((row) => [row.code, row.id]));

const unitRows = rooms.map((room, index) => ({
  property_id: propertyId,
  room_type_id: typeId.get(room.category),
  label: room.door,
  floor_label: room.floor,
  hk_status: "clean",
  sort_order: index + 1,
  notes: room.aliases.length ? `Aliases: ${room.aliases.join("; ")}` : null,
}));
for (const [code, labels] of [
  ["guide", ["GUIDE-01", "GUIDE-02"]],
  ["driver", ["DRIVER-01", "DRIVER-02"]],
]) {
  labels.forEach((label, index) => {
    unitRows.push({
      property_id: propertyId,
      room_type_id: typeId.get(code),
      label,
      floor_label: null,
      hk_status: "clean",
      sort_order: 200 + unitRows.length + index,
      notes: null,
    });
  });
}
await db.insert("room_units", unitRows, "property_id,label");

const savedUnits = await db.select(
  `room_units?select=label&property_id=eq.${propertyId}`,
);
const doors = savedUnits.filter(
  (row) => !row.label.startsWith("GUIDE") && !row.label.startsWith("DRIVER"),
);
console.log(
  JSON.stringify(
    {
      tenantId,
      propertyId,
      slug: PROPERTY_SLUG,
      doors: doors.length,
      practiceUntouched: practiceId,
      workbook: workbookPath,
    },
    null,
    2,
  ),
);
