/**
 * Write found Pelbu figures onto the stay:
 * payment-sheet total and money received, plus reservation quotes where the comment has an amount.
 * Does not invent a rate when the comment has no figure, and does not add a second room charge.
 *
 *   node --env-file=.env.local scripts/pelbu-olakha-apply-found-money.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-apply-found-money.mjs --apply
 */
import { readFileSync } from "node:fs";
import { parseRack } from "./lib/pelbu-olakha-rack.mjs";
import { restClient } from "./lib/supabase-rest.mjs";
import {
  readZip,
  rowsFromCells,
  sharedStrings,
  sheetCells,
  workbookSheets,
} from "./lib/xlsx-lite.mjs";

const APPLY = process.argv.includes("--apply");
const TODAY = "2026-10-24";
const PAY_PATH = "C:/Users/rajiv/Downloads/Travel Agent Payment .xlsx";
const RACK_PATH = "C:/Users/rajiv/Downloads/Reservation 2026 (3).xlsx";
const TAG = "olakha-found:";

function num(v) {
  if (v === "" || v === "-" || v == null) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function iso(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1000) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
    .toISOString()
    .slice(0, 10);
}
function norm(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/journery/g, "journey")
    .replace(/bhuan/g, "bhutan")
    .replace(/sliver/g, "silver")
    .replace(/\b(mr|mrs|ms|miss|group)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokens(text) {
  return norm(text)
    .split(" ")
    .filter(
      (t) =>
        t.length >= 3 &&
        !/^\d+$/.test(t) &&
        !["guest", "pax", "room", "plan", "and", "the"].includes(t),
    );
}
function overlap(a, b) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.min(ta.size, tb.size);
}
function completed(agent) {
  const n = norm(agent);
  return (
    n.includes("vacation adda") ||
    n.includes("southeast himalaya") ||
    n.includes("silver pine")
  );
}

function readSheet() {
  const z = readZip(readFileSync(PAY_PATH));
  const strings = sharedStrings(
    z.get("xl/sharedStrings.xml")?.toString("utf8") ?? "<sst></sst>",
  );
  const rows = rowsFromCells(
    sheetCells(z.get(workbookSheets(z)[0].path).toString("utf8"), strings),
  );
  const out = [];
  for (const r of rows) {
    const agent = String(r[0] ?? "").trim();
    if (!agent || agent.includes("Travel Agent")) continue;
    const total = round2(num(r[10]));
    const received = round2(num(r[11]));
    const outstanding = round2(num(r[12]));
    if (!(total > 0 || received > 0 || outstanding > 0)) continue;
    const cinRaw = iso(r[4]);
    const coutRaw = iso(r[5]);
    out.push({
      agent,
      guest: String(r[1] ?? "").trim(),
      cin: cinRaw?.startsWith("2027-") ? `2026-${cinRaw.slice(5)}` : cinRaw,
      cout: coutRaw?.startsWith("2027-") ? `2026-${coutRaw.slice(5)}` : coutRaw,
      total,
      received,
      outstanding,
      status: String(r[13] ?? "").trim(),
    });
  }
  return out;
}

async function loadBookings(db, propertyId) {
  const agents = await db.select("agents?select=id,company_name&limit=2000");
  const agentName = new Map(agents.map((a) => [a.id, a.company_name]));
  const bookings = [];
  for (let offset = 0; ; offset += 500) {
    const batch = await db.select(
      `bookings?select=id,external_ref,agent_id,contact_name,check_in,check_out,status,quoted_total_btn,notes&property_id=eq.${propertyId}&order=check_in.asc&limit=500&offset=${offset}`,
    );
    bookings.push(...batch);
    if (batch.length < 500) break;
  }
  const folios = [];
  for (let i = 0; i < bookings.length; i += 40) {
    const ids = bookings.slice(i, i + 40).map((b) => b.id).join(",");
    const chunk = await db.select(
      `folios?select=id,booking_id,status,folio_lines(total_btn,status,source_type)&property_id=eq.${propertyId}&booking_id=in.(${ids})&limit=200`,
    );
    folios.push(...chunk);
  }
  const byBooking = new Map();
  for (const folio of folios) {
    const list = byBooking.get(folio.booking_id) || [];
    list.push(folio);
    byBooking.set(folio.booking_id, list);
  }
  return bookings.map((b) => {
    const stayFolios = byBooking.get(b.id) || [];
    let paid = 0;
    let folioId = null;
    for (const folio of stayFolios) {
      if (!folioId || folio.status === "open") folioId = folio.id;
      for (const line of folio.folio_lines || []) {
        if (line.status !== "posted") continue;
        const src = String(line.source_type || "").toLowerCase();
        if (src === "payment" || src === "deposit") paid += -Number(line.total_btn || 0);
      }
    }
    return {
      ...b,
      agent: agentName.get(b.agent_id) || "",
      paid: round2(paid),
      folioId,
    };
  });
}

function pickBooking(row, bookings) {
  const scored = bookings
    .map((b) => {
      let score = 0;
      if (row.cin && b.check_in === row.cin) score += 40;
      if (row.cout && b.check_out === row.cout) score += 20;
      const guest = overlap(row.guest, b.contact_name || "");
      if (guest >= 0.5) score += Math.round(30 * guest);
      const agent = overlap(row.agent, b.agent || "");
      if (agent >= 0.5) score += 15;
      return { b, score };
    })
    .filter((x) => x.score >= 55)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].score - scored[1].score < 8) return null;
  return scored[0].b;
}

async function postPayment(db, propertyId, booking, amount, note) {
  const key = `${TAG}${booking.id}:${amount}`;
  const existing = await db.select(
    `payments?select=id&property_id=eq.${propertyId}&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`,
  );
  if (existing[0] || !booking.folioId) return false;
  const payRows = await db.insert("payments", {
    property_id: propertyId,
    folio_id: booking.folioId,
    booking_id: booking.id,
    method: "bank",
    kind: "settlement",
    amount_btn: amount,
    reference: "Travel agent bill",
    notes: note,
    idempotency_key: key,
    confirmation_status: "confirmed",
  });
  const paymentId = payRows[0].id;
  await db.insert("folio_lines", {
    folio_id: booking.folioId,
    booking_id: booking.id,
    source_type: "payment",
    source_id: paymentId,
    description: `Payment · bank · ${note}`,
    qty: 1,
    unit_price_btn: -amount,
    amount_btn: -amount,
    gst_applicable: false,
    gst_btn: 0,
    total_btn: -amount,
    status: "posted",
    bill_to: "agent",
  });
  booking.paid = round2(booking.paid + amount);
  return true;
}

const db = restClient();
const props = await db.select(
  "properties?select=id,name&slug=eq.pelbu-olakha",
);
const propertyId = props[0].id;
const bookings = await loadBookings(db, propertyId);
const sheet = readSheet();
const used = new Set();

let quoteUpdates = 0;
let payments = 0;
let unmatched = 0;
let completedPaid = 0;

for (const row of sheet) {
  const booking = pickBooking(row, bookings);
  if (!booking || used.has(booking.id)) {
    unmatched += 1;
    console.log("UNMATCHED", row.agent, row.guest, row.cin, row.total);
    continue;
  }
  used.add(booking.id);
  const targetPaid = completed(row.agent) ? row.total : row.received;
  const need = round2(Math.max(0, targetPaid - booking.paid));
  const quoteChanged =
    row.total > 0 && Math.abs(Number(booking.quoted_total_btn || 0) - row.total) > 0.5;
  console.log(
    completed(row.agent) ? "DONE" : "SHEET",
    row.agent,
    row.guest,
    row.cin,
    "bill",
    row.total,
    "target paid",
    targetPaid,
    "already",
    booking.paid,
    "post",
    need,
    "->",
    booking.contact_name,
  );
  if (!APPLY) continue;
  if (quoteChanged) {
    await db.update(`bookings?id=eq.${booking.id}`, {
      quoted_total_btn: row.total,
    });
    quoteUpdates += 1;
  }
  if (need > 0.5) {
    const ok = await postPayment(
      db,
      propertyId,
      booking,
      need,
      completed(row.agent) ? "Collected in full" : "From travel agent bill",
    );
    if (ok) {
      payments += 1;
      if (completed(row.agent)) completedPaid += 1;
    }
  }
}

const rack = parseRack(RACK_PATH, TODAY);
let rackQuotes = 0;
for (const stay of rack.stays || []) {
  const quote = Number(stay.quoted_total_btn);
  if (!(quote >= 500)) continue;
  if (stay.status === "cancelled" || stay.status === "held") continue;
  const booking = bookings.find(
    (b) =>
      b.check_in === stay.check_in &&
      b.check_out === stay.check_out &&
      overlap(stay.guest_name, b.contact_name) >= 0.5,
  );
  if (!booking) continue;
  if (Number(booking.quoted_total_btn) > 0.5) continue;
  console.log(
    "RACK QUOTE",
    stay.agent_code,
    stay.guest_name,
    stay.check_in,
    quote,
    "->",
    booking.contact_name,
  );
  if (!APPLY) continue;
  await db.update(`bookings?id=eq.${booking.id}`, { quoted_total_btn: quote });
  booking.quoted_total_btn = quote;
  rackQuotes += 1;
}

console.log(
  APPLY ? "APPLIED" : "DRY",
  "sheet",
  sheet.length,
  "unmatched",
  unmatched,
  "quotes",
  quoteUpdates,
  "payments",
  payments,
  "completed payments",
  completedPaid,
  "rack quotes",
  rackQuotes,
);
