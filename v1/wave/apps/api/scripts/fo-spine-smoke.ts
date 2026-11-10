/**
 * FO spine smoke: book → assign → CI → charge → pay → POS → checkout
 *
 *   pnpm --dir apps/api exec tsx scripts/fo-spine-smoke.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import * as reservations from "../src/adapters/reservations.js";
import * as stayhub from "../src/adapters/stayhub.js";
import * as folio from "../src/adapters/folio.js";
import * as pos from "../src/adapters/pos.js";
import type { AdapterCtx } from "../src/adapters/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFromWeb() {
  const envPath = resolve(__dirname, "../../../web/.env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFromWeb();
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const PROPERTY_ID =
  process.env.SMOKE_PROPERTY_ID || "d06e89f8-86e6-4201-bbd2-5e115d422357";

const admin = createClient(url, key, {
  auth: { persistSession: false },
}) as AdapterCtx["admin"];

const { data: staff } = await admin
  .from("staff_members")
  .select("id")
  .eq("property_id", PROPERTY_ID)
  .limit(1)
  .maybeSingle();

const ctx: AdapterCtx = {
  admin,
  jwt: {
    sub: (staff?.id as string) || randomUUID(),
    propertyId: PROPERTY_ID,
    staffId: (staff?.id as string) || randomUUID(),
    staffName: "FO Spine Smoke",
    deskRole: "gm",
    employeeCode: "smoke",
  },
};

const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Thimphu",
});
const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000)
  .toISOString()
  .slice(0, 10);
const dayAfter = new Date(Date.parse(`${today}T00:00:00Z`) + 2 * 86400000)
  .toISOString()
  .slice(0, 10);

const { data: roomType } = await admin
  .from("room_types")
  .select("id")
  .eq("property_id", PROPERTY_ID)
  .eq("inventory_kind", "sellable_guest")
  .order("name")
  .limit(1)
  .maybeSingle();
if (!roomType) throw new Error("No sellable room type");

const { data: units } = await admin
  .from("room_units")
  .select("id, label")
  .eq("property_id", PROPERTY_ID)
  .eq("room_type_id", roomType.id)
  .order("label")
  .limit(40);

const { data: busy } = await admin
  .from("room_assignments")
  .select("room_unit_id, from_date, to_date")
  .eq("property_id", PROPERTY_ID)
  .lt("from_date", dayAfter)
  .gt("to_date", tomorrow);

const occupied = new Set(
  (busy || []).map((r) => r.room_unit_id as string),
);
const free = (units || []).find((u) => !occupied.has(u.id as string));
if (!free) throw new Error("No free unit for smoke window");

console.log("1) createReservation…");
const created = await reservations.createReservation(ctx, {
  idempotencyKey: randomUUID(),
  contactName: `Smoke Guest ${Date.now().toString(36)}`,
  contactPhone: "+97517110000",
  checkIn: tomorrow,
  checkOut: dayAfter,
  adults: 2,
  rooms: 1,
  roomTypeId: roomType.id as string,
  mealPlanCode: "MAP",
  intent: "confirm",
  agreedNightlyRateBtn: 3500,
});
console.log("   ", {
  bookingId: created.bookingId,
  confirmationCode: created.confirmationCode,
  status: created.status,
});
if (
  !created.confirmationCode ||
  !String(created.confirmationCode).includes("BK-")
) {
  throw new Error(
    `Expected trigger confirmation_code with BK-, got ${created.confirmationCode}`,
  );
}

console.log("2) assignRoom…");
const assigned = await stayhub.assignRoom(ctx, {
  bookingId: created.bookingId as string,
  roomUnitId: free.id as string,
  idempotencyKey: randomUUID(),
});
console.log("   ", assigned);

const { data: asg } = await admin
  .from("room_assignments")
  .select("from_date, to_date, room_unit_id")
  .eq("booking_id", created.bookingId as string)
  .maybeSingle();
if (!asg?.from_date || !asg?.to_date) {
  throw new Error("room_assignments missing from_date/to_date");
}

console.log("3) checkInStay…");
const cin = await stayhub.checkInStay(ctx, {
  bookingId: created.bookingId as string,
  idempotencyKey: randomUUID(),
});
console.log("   ", cin);
if (cin.status !== "checked_in") throw new Error("CI status not checked_in");

console.log("4) postFolioCharge…");
const charge = await folio.postFolioCharge(ctx, {
  bookingId: created.bookingId as string,
  description: "Smoke room night",
  amountBtn: 3500,
  kind: "room",
  idempotencyKey: randomUUID(),
});
console.log("   ", charge);

console.log("5) postFolioPayment…");
const pay = await folio.postFolioPayment(ctx, {
  bookingId: created.bookingId as string,
  amountBtn: 3500,
  method: "cash",
  idempotencyKey: randomUUID(),
});
console.log("   ", pay);

console.log("6) createPosOrder…");
const menu = await pos.listPosMenu(ctx);
const item = menu.items[0];
const order = await pos.createPosOrder(ctx, {
  idempotencyKey: randomUUID(),
  bookingId: created.bookingId as string,
  tableLabel: "Smoke",
  fireKot: true,
  lines: [
    {
      menuItemId: item?.id,
      name: item?.name || "Smoke item",
      qty: 1,
      unitPriceBtn: item?.priceBtn || 100,
    },
  ],
});
console.log("   ", order);

const bal = await folio.getFolioBalance(ctx, created.bookingId as string);
console.log("7) balance…", bal);
if (bal.balanceBtn > 0.009) {
  await folio.postFolioPayment(ctx, {
    bookingId: created.bookingId as string,
    amountBtn: bal.balanceBtn,
    method: "cash",
    idempotencyKey: randomUUID(),
  });
}

console.log("8) checkoutStay…");
const cout = await stayhub.checkoutStay(ctx, {
  bookingId: created.bookingId as string,
  idempotencyKey: randomUUID(),
  allowBalance: false,
});
console.log("   ", cout);

const finalBal = await folio.getFolioBalance(ctx, created.bookingId as string);
console.log("OK fo-spine-smoke passed", {
  confirmationCode: created.confirmationCode,
  finalBalance: finalBal.balanceBtn,
});
