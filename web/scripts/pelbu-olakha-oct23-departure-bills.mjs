/**
 * 23 Oct 2026 Pelbu departures: sheet doors, net room lines, food, invoices.
 * Idempotent. Does not strip GST twice.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv("C:/GitHub/Hotel OS Bhutan/web/.env.local");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const PROPERTY_ID = "d06e89f8-86e6-4201-bbd2-5e115d422357";
const round = (n) => Math.round(Number(n) * 100) / 100;

function splitTotal(total, count) {
  const base = round(total / count);
  const parts = Array.from({ length: count }, () => base);
  parts[count - 1] = round(total - base * (count - 1));
  return parts;
}

function withService(total) {
  const amount = round(total / 1.1);
  return { amount_btn: amount, service_charge_btn: round(total - amount), total_btn: round(total) };
}

const STAYS = [
  {
    code: "PS-2026-00054",
    name: null,
    doors: ["204", "205"],
    nights: ["2026-10-20", "2026-10-21", "2026-10-22"],
    roomTotal: 34285.74,
    billTo: "agent",
    perDoorNight: 5714.29,
  },
  {
    code: "PS-2026-00012",
    name: null,
    doors: ["201"],
    nights: ["2026-10-21", "2026-10-22"],
    roomTotal: 10666.67,
    billTo: "guest",
  },
  {
    code: "PS-2026-00184",
    name: "Thapas Dhatha",
    doors: ["402"],
    nights: ["2026-10-20", "2026-10-21", "2026-10-22"],
    roomTotal: 15428.57,
    billTo: "agent",
  },
  {
    code: "PS-2026-00304",
    name: null,
    doors: ["506"],
    nights: ["2026-10-20", "2026-10-21", "2026-10-22"],
    roomTotal: 16000,
    billTo: "agent",
    food: {
      total: 900,
      description:
        "Lunch · Chicken 500, Daal 200, Sabji complimentary, Rice 200",
      alsoDescriptions: [
        "Lunch · Chicken 500, Daal 200, Sabji 360, Rice 200",
      ],
      service: false,
    },
  },
];

async function unitByLabel(label) {
  const { data, error } = await admin
    .from("room_units")
    .select("id, label")
    .eq("property_id", PROPERTY_ID)
    .eq("label", label)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No room ${label}`);
  return data;
}

async function ensureFolio(booking) {
  const { data: existing, error } = await admin
    .from("folios")
    .select("id, status")
    .eq("booking_id", booking.id)
    .eq("status", "open")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing?.id) return existing.id;
  const { data: folio, error: insErr } = await admin
    .from("folios")
    .insert({
      property_id: PROPERTY_ID,
      booking_id: booking.id,
      folio_type: "guest",
      label: booking.contact_name || booking.confirmation_code,
      status: "open",
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  return folio.id;
}

async function doorFree(unitId, booking, from, to) {
  const { data, error } = await admin
    .from("room_assignments")
    .select("id, booking_id, from_date, to_date")
    .eq("property_id", PROPERTY_ID)
    .eq("room_unit_id", unitId)
    .lt("from_date", to)
    .gt("to_date", from);
  if (error) throw new Error(error.message);
  const others = (data ?? []).filter((row) => row.booking_id !== booking.id);
  return others.length === 0;
}

async function alignDoors(booking, labels) {
  const units = [];
  for (const label of labels) units.push(await unitByLabel(label));
  const { data: assigns, error } = await admin
    .from("room_assignments")
    .select("id, room_unit_id, from_date, to_date")
    .eq("booking_id", booking.id)
    .order("from_date");
  if (error) throw new Error(error.message);
  const rows = assigns ?? [];
  const notes = [];
  if (rows.length < labels.length) {
    notes.push(`has ${rows.length} assignments, sheet wants ${labels.length}`);
  }
  for (let i = 0; i < Math.min(rows.length, units.length); i += 1) {
    const row = rows[i];
    const unit = units[i];
    if (row.room_unit_id === unit.id) continue;
    const free = await doorFree(
      unit.id,
      booking,
      row.from_date,
      row.to_date,
    );
    if (!free) {
      notes.push(`${unit.label} is occupied for these dates`);
      continue;
    }
    const { error: upErr } = await admin
      .from("room_assignments")
      .update({ room_unit_id: unit.id })
      .eq("id", row.id);
    if (upErr) notes.push(`${unit.label}: ${upErr.message}`);
    else notes.push(`moved to ${unit.label}`);
  }
  return { units, assigns: rows, notes };
}

async function postRoomLines(booking, folioId, stay, units, assigns) {
  const { data: existing, error } = await admin
    .from("folio_lines")
    .select("id, total_btn, status, source_type")
    .eq("folio_id", folioId)
    .eq("source_type", "room")
    .eq("status", "posted");
  if (error) throw new Error(error.message);
  const current = round(
    (existing ?? []).reduce((s, line) => s + Number(line.total_btn || 0), 0),
  );
  if (Math.abs(current - stay.roomTotal) < 0.02) {
    return { posted: 0, current, skipped: true };
  }
  if (existing?.length) {
    const { error: voidErr } = await admin
      .from("folio_lines")
      .update({ status: "voided" })
      .in(
        "id",
        existing.map((line) => line.id),
      );
    if (voidErr) throw new Error(voidErr.message);
  }
  const slots = [];
  const count = Math.min(assigns.length, units.length, stay.doors.length);
  for (let d = 0; d < count; d += 1) {
    for (const night of stay.nights) {
      slots.push({ night, unit: units[d], assign: assigns[d] });
    }
  }
  const amounts = stay.perDoorNight
    ? slots.map(() => stay.perDoorNight)
    : splitTotal(stay.roomTotal, slots.length);
  let posted = 0;
  for (let i = 0; i < slots.length; i += 1) {
    const money = withService(amounts[i]);
    const slot = slots[i];
    const { error: insErr } = await admin.from("folio_lines").insert({
      folio_id: folioId,
      booking_id: booking.id,
      source_type: "room",
      source_id: slot.assign?.id ?? null,
      description: `Room ${slot.unit.label} · ${slot.night} · net of GST`,
      qty: 1,
      unit_price_btn: money.amount_btn,
      amount_btn: money.amount_btn,
      service_charge_rate: 0.1,
      service_charge_btn: money.service_charge_btn,
      service_charge_applied: true,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: money.total_btn,
      business_date: slot.night,
      room_unit_id: slot.unit.id,
      status: "posted",
      bill_to: stay.billTo,
      tax_treatment: "net",
    });
    if (insErr) throw new Error(`${stay.code} ${slot.night}: ${insErr.message}`);
    posted += 1;
  }
  return { posted, current, skipped: false };
}

async function postFood(booking, folioId, food) {
  const descriptions = [
    food.description,
    ...(food.alsoDescriptions ?? []),
  ];
  const { data: existing, error } = await admin
    .from("folio_lines")
    .select("id, total_btn")
    .eq("folio_id", folioId)
    .eq("status", "posted")
    .eq("source_type", "order")
    .in("description", descriptions);
  if (error) throw new Error(error.message);
  const current = round(
    (existing ?? []).reduce((s, line) => s + Number(line.total_btn || 0), 0),
  );
  if (Math.abs(current - food.total) < 0.02) return { posted: false, current };
  if (existing?.length) {
    const { error: voidErr } = await admin
      .from("folio_lines")
      .update({ status: "voided" })
      .in(
        "id",
        existing.map((line) => line.id),
      );
    if (voidErr) throw new Error(voidErr.message);
  }
  const money = food.service ? withService(food.total) : {
    amount_btn: food.total,
    service_charge_btn: 0,
    total_btn: food.total,
  };
  const { error: insErr } = await admin.from("folio_lines").insert({
    folio_id: folioId,
    booking_id: booking.id,
    source_type: "order",
    description: food.description,
    qty: 1,
    unit_price_btn: money.amount_btn,
    amount_btn: money.amount_btn,
    service_charge_rate: food.service ? 0.1 : 0,
    service_charge_btn: money.service_charge_btn,
    service_charge_applied: Boolean(food.service),
    gst_applicable: false,
    gst_btn: 0,
    total_btn: money.total_btn,
    status: "posted",
    bill_to: "guest",
    business_date: "2026-10-23",
  });
  if (insErr) throw new Error(insErr.message);
  return { posted: true, current };
}

async function fixUdaanCafe(folioId, bookingId) {
  const orderId = "22488794-84b5-4f2d-ab05-b53989f08529";
  const { data: items, error } = await admin
    .from("order_items")
    .select("id, name_snapshot, qty, unit_price_btn")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  for (const item of items ?? []) {
    const name = String(item.name_snapshot ?? "");
    if (!/k5/i.test(name)) continue;
    const { error: upErr } = await admin
      .from("order_items")
      .update({ unit_price_btn: 250 })
      .eq("id", item.id);
    if (upErr) throw new Error(upErr.message);
  }
  const { data: fresh, error: freshErr } = await admin
    .from("order_items")
    .select("qty, unit_price_btn")
    .eq("order_id", orderId);
  if (freshErr) throw new Error(freshErr.message);
  const subtotal = round(
    (fresh ?? []).reduce(
      (s, item) => s + Number(item.qty || 0) * Number(item.unit_price_btn || 0),
      0,
    ),
  );
  const sc = round(subtotal * 0.1);
  const total = round(subtotal + sc);
  await admin
    .from("orders")
    .update({
      subtotal_btn: subtotal,
      service_charge_btn: sc,
      gst_btn: 0,
      total_btn: total,
    })
    .eq("id", orderId);
  const { data: lines, error: lineErr } = await admin
    .from("folio_lines")
    .select("id")
    .eq("folio_id", folioId)
    .eq("source_id", orderId)
    .eq("status", "posted");
  if (lineErr) throw new Error(lineErr.message);
  if (lines?.length) {
    const { error: upErr } = await admin
      .from("folio_lines")
      .update({
        amount_btn: subtotal,
        unit_price_btn: subtotal,
        service_charge_rate: 0.1,
        service_charge_btn: sc,
        service_charge_applied: true,
        gst_btn: 0,
        total_btn: total,
        description: "Cafe · K5 at 250 · service charge 10%",
      })
      .eq("id", lines[0].id);
    if (upErr) throw new Error(upErr.message);
  } else {
    const { error: insErr } = await admin.from("folio_lines").insert({
      folio_id: folioId,
      booking_id: bookingId,
      source_type: "order",
      source_id: orderId,
      description: "Cafe · K5 at 250 · service charge 10%",
      qty: 1,
      unit_price_btn: subtotal,
      amount_btn: subtotal,
      service_charge_rate: 0.1,
      service_charge_btn: sc,
      service_charge_applied: true,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: total,
      status: "posted",
      bill_to: "guest",
      business_date: "2026-10-23",
    });
    if (insErr) throw new Error(insErr.message);
  }
  return { subtotal, sc, total };
}

async function issueInvoice(folioId, bookingId) {
  const { data: existing, error } = await admin
    .from("fiscal_documents")
    .select("id, doc_no")
    .eq("property_id", PROPERTY_ID)
    .eq("folio_id", folioId)
    .eq("doc_kind", "invoice")
    .eq("status", "issued")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing?.doc_no) return { docNo: existing.doc_no, created: false };
  const { data: seq, error: seqErr } = await admin.rpc("next_property_sequence", {
    p_property_id: PROPERTY_ID,
    p_kind: "invoice:2026",
  });
  if (seqErr) throw new Error(seqErr.message);
  const docNo = `INV-2026-${String(seq).padStart(4, "0")}`;
  const { error: insErr } = await admin.from("fiscal_documents").insert({
    property_id: PROPERTY_ID,
    doc_kind: "invoice",
    doc_no: docNo,
    fiscal_year: 2026,
    sequence_no: Number(seq),
    folio_id: folioId,
    booking_id: bookingId,
    issued_by: "desk",
    status: "issued",
    meta: { issue_date: "2026-10-23", source: "oct23-departure-bills" },
  });
  if (insErr) throw new Error(insErr.message);
  return { docNo, created: true };
}

async function loadBooking(code) {
  const { data, error } = await admin
    .from("bookings")
    .select("id, confirmation_code, contact_name, status, check_in, check_out")
    .eq("property_id", PROPERTY_ID)
    .eq("confirmation_code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Missing ${code}`);
  return data;
}

async function findArjun() {
  const { data, error } = await admin
    .from("bookings")
    .select("id, confirmation_code, contact_name, status, check_in, check_out")
    .eq("property_id", PROPERTY_ID)
    .ilike("contact_name", "%arjun%")
    .neq("status", "cancelled");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const dated = rows.filter((row) =>
    String(row.check_out ?? "").startsWith("2026-10-23"),
  );
  return (dated[0] ?? rows[0]) || null;
}

const report = [];

const { error: bankErr } = await admin
  .from("properties")
  .update({
    tax_id: "PBB24478",
    bank_accounts: [
      {
        label: "Pelbu Suites Olakha",
        bank: "BNB",
        account: "642078924",
        hint: "RRCO TPN PBB24478",
        qr_url: "/brand/pelbu-bnb-qr.png",
      },
    ],
  })
  .eq("id", PROPERTY_ID);
if (bankErr) throw new Error(bankErr.message);
report.push({ pay: "BNB 642078924 TPN PBB24478" });

for (const stay of STAYS) {
  const booking = await loadBooking(stay.code);
  if (stay.name && booking.contact_name !== stay.name) {
    await admin
      .from("bookings")
      .update({ contact_name: stay.name })
      .eq("id", booking.id);
    booking.contact_name = stay.name;
  }
  const folioId = await ensureFolio(booking);
  const doors = await alignDoors(booking, stay.doors);
  const room = await postRoomLines(
    booking,
    folioId,
    stay,
    doors.units,
    doors.assigns,
  );
  let food = null;
  if (stay.code === "PS-2026-00054") {
    food = await fixUdaanCafe(folioId, booking.id);
  } else if (stay.food) {
    food = await postFood(booking, folioId, stay.food);
  }
  const invoice = await issueInvoice(folioId, booking.id);
  report.push({
    code: stay.code,
    name: booking.contact_name,
    doors: doors.notes,
    room,
    food,
    invoice,
  });
}

const arjun = await findArjun();
if (!arjun) {
  report.push({ arjun: "not found" });
} else {
  const stay = {
    code: arjun.confirmation_code,
    doors: ["307"],
    nights: ["2026-10-22"],
    roomTotal: 2500,
    billTo: "guest",
    perDoorNight: 2500,
  };
  const folioId = await ensureFolio(arjun);
  const doors = await alignDoors(arjun, ["307"]);
  const room = await postRoomLines(arjun, folioId, stay, doors.units, doors.assigns);
  const food = await postFood(arjun, folioId, {
    total: 450,
    description: "Dinner buffet · 1 pax · 450",
    service: false,
  });
  const invoice = await issueInvoice(folioId, arjun.id);
  report.push({
    code: arjun.confirmation_code,
    name: arjun.contact_name,
    doors: doors.notes,
    room,
    food,
    invoice,
  });
}

console.log(JSON.stringify(report, null, 2));
