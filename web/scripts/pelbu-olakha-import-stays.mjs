/**
 * Load Pelbu-Olakha-import-2026.xlsx into property pelbu-olakha.
 * Idempotent on bookings.external_ref. Does not post folios or payments.
 * Cancelled stays are saved without a room assignment so a later stay can use the door.
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/pelbu-olakha-import-stays.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-import-stays.mjs --apply
 */

import { readFileSync } from "node:fs";
import { restClient } from "./lib/supabase-rest.mjs";
import {
  readZip,
  rowsFromCells,
  sharedStrings,
  sheetCells,
  workbookSheets,
} from "./lib/xlsx-lite.mjs";
import { PRACTICE_SLUG, PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";

function argValue(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

const APPLY = process.argv.includes("--apply");
const workbookPath =
  argValue("--workbook=") ||
  "C:/Users/rajiv/Downloads/Pelbu-Olakha-import-2026.xlsx";

function sheetRows(files, name) {
  const strings = sharedStrings(
    files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "<sst></sst>",
  );
  const sheet = workbookSheets(files).find((item) => item.name === name);
  if (!sheet) throw new Error(`Workbook is missing the ${name} sheet.`);
  const xml = files.get(sheet.path)?.toString("utf8") ?? "";
  const rows = rowsFromCells(sheetCells(xml, strings));
  const header = rows[0].map((cell) => String(cell).trim());
  return rows.slice(1).filter((row) => row.some((cell) => String(cell).trim())).map((row) => {
    const record = {};
    header.forEach((key, index) => {
      record[key] = String(row[index] ?? "").trim();
    });
    return record;
  });
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function runs(dates) {
  const sorted = [...dates].sort();
  const out = [];
  for (const date of sorted) {
    const last = out[out.length - 1];
    if (last && addDays(last.to, 0) === date) {
      last.to = addDays(date, 1);
    } else if (last && last.to === date) {
      last.to = addDays(date, 1);
    } else {
      out.push({ from: date, to: addDays(date, 1) });
    }
  }
  return out;
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const files = readZip(readFileSync(workbookPath));
const stays = sheetRows(files, "Stays");
const nights = sheetRows(files, "RoomNights");
const nightsByStay = new Map();
for (const night of nights) {
  if (!night.stay_key || !night.door || !night.date) continue;
  const list = nightsByStay.get(night.stay_key) ?? [];
  list.push(night);
  nightsByStay.set(night.stay_key, list);
}

const db = restClient();
const practice = await db.select(
  `properties?select=id,slug&slug=eq.${PRACTICE_SLUG}`,
);
const properties = await db.select(
  `properties?select=id,slug,name&slug=eq.${PROPERTY_SLUG}`,
);
const property = properties[0];
if (!property || property.slug !== PROPERTY_SLUG) {
  throw new Error(`Property ${PROPERTY_SLUG} was not found. Run the provision script first.`);
}
if (practice[0] && practice[0].id === property.id) {
  throw new Error("Refusing to import into the practice property.");
}

const roomTypes = await db.select(
  `room_types?select=id,code,inventory_kind&property_id=eq.${property.id}`,
);
const typeById = new Map(roomTypes.map((row) => [row.id, row]));
const units = await db.select(
  `room_units?select=id,label,room_type_id&property_id=eq.${property.id}`,
);
const unitByLabel = new Map(units.map((row) => [row.label, row]));

const importable = stays.filter((stay) => stay.blocking !== "yes" && stay.external_ref);
const blocked = stays.length - importable.length;
const summary = {
  apply: APPLY,
  stays: stays.length,
  blocked,
  inserted: 0,
  skippedExisting: 0,
  failed: 0,
  assignments: 0,
  assignmentSkipped: 0,
};

const agentCache = new Map();
async function agentIdFor(name) {
  const company = name.trim();
  if (!company) return null;
  const cacheKey = company.toLowerCase();
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);
  const safe = company.replace(/[%*,()]/g, " ").replace(/\s+/g, " ").trim();
  const found = await db.select(
    `agents?select=id,company_name&company_name=ilike.${encodeURIComponent(safe)}&limit=5`,
  );
  let id =
    found.find((row) => row.company_name.trim().toLowerCase() === cacheKey)?.id ??
    null;
  if (!id && APPLY) {
    const inserted = await db.insert("agents", {
      company_name: company,
      market: "bhutan",
      status: "approved",
      rate_tier: "agents",
      credit_limit: 0,
      credit_used: 0,
      contact_name: company,
    });
    id = inserted[0].id;
  }
  if (id && APPLY) {
    await db.insert(
      "agent_property_links",
      {
        agent_id: id,
        property_id: property.id,
        status: "approved",
        rate_tier: "agents",
        credit_limit: 0,
        credit_used: 0,
      },
      "agent_id,property_id",
    );
  }
  agentCache.set(cacheKey, id);
  return id;
}

const guideCache = new Map();
async function guideIdFor(name, phone) {
  const fullName = name.trim();
  const guideNumber = phone.trim() || (fullName ? `name:${slug(fullName)}` : "");
  if (!guideNumber) return null;
  if (guideCache.has(guideNumber)) return guideCache.get(guideNumber);
  const found = await db.select(
    `guides?select=id&property_id=eq.${property.id}&guide_number=eq.${encodeURIComponent(guideNumber)}&limit=1`,
  );
  let id = found[0]?.id ?? null;
  if (!id && APPLY) {
    const inserted = await db.insert("guides", {
      property_id: property.id,
      guide_number: guideNumber,
      full_name: fullName || null,
      phone: phone.trim() || null,
    });
    id = inserted[0].id;
  }
  guideCache.set(guideNumber, id);
  return id;
}

function noteText(stay) {
  const parts = [];
  if (stay.ai_package === "yes") {
    parts.push("All-inclusive package (AI) from the reservation rack.");
  }
  if (stay.payment_note) parts.push(stay.payment_note);
  if (stay.diet) parts.push(`Diet: ${stay.diet}`);
  if (stay.eta) parts.push(`ETA: ${stay.eta}`);
  if (stay.warnings) parts.push(`Import notes: ${stay.warnings}`);
  if (stay.raw_comment) parts.push(stay.raw_comment);
  return parts.join("\n\n").slice(0, 8000);
}

for (const stay of importable) {
  const existing = await db.select(
    `bookings?select=id&property_id=eq.${property.id}&external_ref=eq.${encodeURIComponent(stay.external_ref)}&limit=1`,
  );
  if (existing.length) {
    summary.skippedExisting += 1;
    continue;
  }
  if (!APPLY) {
    summary.inserted += 1;
    continue;
  }

  try {
    const agentId =
      stay.source === "agent" && stay.agent_name
        ? await agentIdFor(stay.agent_name)
        : null;
    const guideId = await guideIdFor(stay.guide_name || "", stay.guide_phone || "");
    const meal = ["EP", "BB", "MAP", "AP"].includes(stay.meal_plan_code)
      ? stay.meal_plan_code
      : "EP";
    const adults = Math.max(1, Math.min(400, Number(stay.adults) || 1));
    const extraBeds = Math.max(0, Math.min(2, Number(stay.extra_beds) || 0));
    const quoted = stay.quoted_total_btn ? Number(stay.quoted_total_btn) : null;
    const doorLabels = (stay.room_labels || "")
      .split(",")
      .map((label) => label.trim())
      .filter((label) => unitByLabel.has(label));
    const checkInAt =
      stay.status === "checked_in" || stay.status === "checked_out"
        ? `${stay.check_in}T08:00:00+06:00`
        : null;
    const checkOutAt =
      stay.status === "checked_out" ? `${stay.check_out}T06:00:00+06:00` : null;

    const inserted = await db.insert("bookings", {
      property_id: property.id,
      agent_id: agentId,
      source: stay.source || "agent",
      guest_origin: stay.guest_origin || "international",
      check_in: stay.check_in,
      check_out: stay.check_out,
      status: stay.status || "confirmed",
      contact_name: stay.guest_name || stay.agent_name || stay.agent_code,
      contact_phone: stay.guide_phone || null,
      adults,
      children: 0,
      rooms: Math.max(doorLabels.length, 1),
      extra_beds: extraBeds,
      notes: noteText(stay),
      meal_plan_code: meal,
      quoted_total_btn: Number.isFinite(quoted) ? quoted : null,
      external_ref: stay.external_ref,
      guide_id: guideId,
      guide_number: guideId ? stay.guide_phone || `name:${slug(stay.guide_name)}` : null,
      booked_by_role: ["owner", "agent", "client"].includes(stay.source)
        ? stay.source
        : null,
      checked_in_at: checkInAt,
      checked_out_at: checkOutAt,
      cancelled_at: stay.status === "cancelled" ? `${stay.check_in}T08:00:00+06:00` : null,
      cancel_reason: stay.status === "cancelled" ? "Imported from the 2026 rack as cancelled." : null,
    });
    const bookingId = inserted[0].id;
    await db.insert("booking_guests", {
      booking_id: bookingId,
      full_name: stay.guest_name || stay.agent_name || "Guest",
      nationality: stay.nationality || null,
      sort_order: 0,
    });

    const qtyByType = new Map();
    for (const label of doorLabels) {
      const unit = unitByLabel.get(label);
      const typeId = unit.room_type_id;
      qtyByType.set(typeId, (qtyByType.get(typeId) ?? 0) + 1);
    }
    if (qtyByType.size) {
      await db.insert(
        "booking_rooms",
        [...qtyByType.entries()].map(([roomTypeId, qty]) => ({
          booking_id: bookingId,
          room_type_id: roomTypeId,
          qty,
          inventory_kind: typeById.get(roomTypeId)?.inventory_kind ?? "sellable_guest",
          meal_plan_code: meal,
          adults,
        })),
      );
    }

    if (stay.status !== "cancelled") {
      const byDoor = new Map();
      for (const night of nightsByStay.get(stay.stay_key) ?? []) {
        const set = byDoor.get(night.door) ?? new Set();
        set.add(night.date);
        byDoor.set(night.door, set);
      }
      for (const [door, dates] of byDoor) {
        const unit = unitByLabel.get(door);
        if (!unit) continue;
        for (const range of runs([...dates])) {
          try {
            await db.insert("room_assignments", {
              property_id: property.id,
              booking_id: bookingId,
              room_unit_id: unit.id,
              from_date: range.from,
              to_date: range.to,
            });
            summary.assignments += 1;
          } catch (error) {
            summary.assignmentSkipped += 1;
            console.error(
              `assignment ${stay.external_ref} ${door} ${range.from}: ${error.message}`,
            );
          }
        }
      }
    }
    summary.inserted += 1;
  } catch (error) {
    summary.failed += 1;
    console.error(`stay ${stay.external_ref}: ${error.message}`);
  }
}

const reviewBlocking = sheetRows(files, "Review").filter(
  (row) => row.severity === "blocking",
);
console.log(
  JSON.stringify(
    {
      ...summary,
      propertyId: property.id,
      reviewBlocking: reviewBlocking.length,
    },
    null,
    2,
  ),
);
