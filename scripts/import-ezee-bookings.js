/**
 * Import eZee Reservation List into Pelbu ERP bookings.
 *
 * Usage (from repo root, with web/.env.local present):
 *   node scripts/import-ezee-bookings.js
 *   node scripts/import-ezee-bookings.js --dry-run
 *   node scripts/import-ezee-bookings.js --active-only
 *
 * Idempotent: skips rows whose external_ref (ezee:SSRESN…) already exists.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require(path.join(
  __dirname,
  "..",
  "web",
  "node_modules",
  "@supabase/supabase-js",
));

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, "web", ".env.local");
const ROWS_PATH = path.join(
  ROOT,
  "marketing",
  "old bookings",
  "ezee-rows.json",
);
const REPORT_PATH = path.join(
  ROOT,
  "marketing",
  "old bookings",
  "ezee-import-report.json",
);

const DRY = process.argv.includes("--dry-run");
const ACTIVE_ONLY = process.argv.includes("--active-only");
const PROPERTY_SLUG = "pelbu-suites-olakha";
const PLACEHOLDER_PHONE = "17112107"; // hotel desk — eZee had no guest phones

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapRoomTypeCode(ezeeType) {
  const t = norm(ezeeType);
  if (t.includes("suite")) return "sr";
  if (t.includes("king") || t.includes("queen") || t.includes("double"))
    return "dq";
  if (t.includes("twin") || t.includes("deluxe")) return "dt";
  return "dt";
}

function mapMealPlan(rateType) {
  const t = norm(rateType);
  if (/\bmap\b|modified american/.test(t)) return "MAP";
  if (/\bap\b|american plan|full board/.test(t)) return "AP";
  if (/\bbb\b|cp\b|breakfast|b\s*b\b/.test(t)) return "BB";
  if (/\bep\b|rack|room only|european/.test(t)) return "EP";
  return "EP";
}

function mapStatus(section) {
  const s = norm(section);
  if (s.includes("void") || s.includes("cancel")) return "cancelled";
  if (s.includes("no show")) return "no_show";
  if (s.includes("check out") || s.includes("depart")) return "checked_out";
  if (s.includes("check in")) return "checked_in";
  return "confirmed";
}

function isWalkInSource(source) {
  const s = norm(source);
  if (!s) return true;
  return (
    /walk\s*in|phone\s*call|walkinn|norzom|prosenjit|checki|ugen|bbt guide|mr\.|ms\./.test(
      s,
    ) ||
    // personal names without tours/travel keywords
    (!/(tour|travel|trek|holiday|dmc|adventure|agency|operator|bhutan(?!ese))/i.test(
      source,
    ) &&
      /^(mr|ms|mrs)\b/i.test(source))
  );
}

function paymentMode(row, hasAgent) {
  if (row.total > 0 && row.paid >= row.total - 0.01) return "prepaid";
  if (row.paid > 0) return "partial";
  if (hasAgent) return "on_credit";
  return "cash";
}

function fuzzyAgentId(source, agents) {
  if (isWalkInSource(source)) return null;
  const sn = norm(source)
    .replace(/\bbhutan\b/g, " ")
    .replace(/\btours?\b/g, " ")
    .replace(/\btrek[sk]?\b/g, " ")
    .replace(/\binternational\b/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!sn || sn.length < 3) return null;

  let best = null;
  let bestScore = 0;
  for (const a of agents) {
    const an = norm(a.company_name);
    if (!an) continue;
    // exact / contains either way
    if (an === norm(source) || an.includes(norm(source)) || norm(source).includes(an)) {
      return a.id;
    }
    const anCore = an
      .replace(/\bbhutan\b/g, " ")
      .replace(/\btours?\b/g, " ")
      .replace(/\btrek[sk]?\b/g, " ")
      .replace(/\binternational\b/g, " ")
      .replace(/\band\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (sn.length >= 4 && anCore.includes(sn)) {
      const score = sn.length / Math.max(anCore.length, 1);
      if (score > bestScore) {
        bestScore = score;
        best = a.id;
      }
    }
    if (anCore.length >= 4 && sn.includes(anCore)) {
      const score = anCore.length / Math.max(sn.length, 1);
      if (score > bestScore) {
        bestScore = score;
        best = a.id;
      }
    }
    // token overlap
    const st = new Set(sn.split(" ").filter((w) => w.length > 3));
    const at = new Set(anCore.split(" ").filter((w) => w.length > 3));
    let hit = 0;
    for (const w of st) if (at.has(w)) hit++;
    if (hit >= 2 || (hit === 1 && st.size === 1)) {
      const score = hit / Math.max(st.size, 1);
      if (score > bestScore) {
        bestScore = score;
        best = a.id;
      }
    }
  }
  return bestScore >= 0.4 ? best : null;
}

async function main() {
  if (!fs.existsSync(ROWS_PATH)) {
    console.error("Missing", ROWS_PATH, "— run parse-ezee-rows.js first");
    process.exit(1);
  }
  const env = loadEnv(ENV_PATH);
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in web/.env.local");
    process.exit(1);
  }

  let rows = JSON.parse(fs.readFileSync(ROWS_PATH, "utf8"));
  if (ACTIVE_ONLY) {
    rows = rows.filter((r) => /active/i.test(r.section));
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: property, error: pErr } = await admin
    .from("properties")
    .select("id, slug, name")
    .eq("slug", PROPERTY_SLUG)
    .single();
  if (pErr || !property) {
    console.error("Property not found", pErr);
    process.exit(1);
  }
  const propertyId = property.id;

  const { data: roomTypes, error: rtErr } = await admin
    .from("room_types")
    .select("id, code, name, inventory_kind")
    .eq("property_id", propertyId);
  if (rtErr || !roomTypes?.length) {
    console.error("Room types missing", rtErr);
    process.exit(1);
  }
  const typeByCode = new Map(roomTypes.map((r) => [r.code, r]));

  const { data: agents, error: aErr } = await admin
    .from("agents")
    .select("id, company_name, status");
  if (aErr) {
    console.error("Agents load failed", aErr);
    process.exit(1);
  }

  // Prefetch existing external refs for this property
  const { data: existing } = await admin
    .from("bookings")
    .select("external_ref")
    .eq("property_id", propertyId)
    .not("external_ref", "is", null);
  const existSet = new Set((existing || []).map((e) => e.external_ref));

  const report = {
    dryRun: DRY,
    activeOnly: ACTIVE_ONLY,
    propertyId,
    totalRows: rows.length,
    inserted: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    errors: [],
    agentMatched: 0,
    agentUnmatchedSources: {},
    byStatus: {},
  };

  for (const row of rows) {
    const externalRef = `ezee:${row.rsrv}`;
    if (existSet.has(externalRef)) {
      report.skippedExisting++;
      continue;
    }
    if (!row.arrival || !row.departure || row.departure <= row.arrival) {
      report.skippedInvalid++;
      report.errors.push({ rsrv: row.rsrv, error: "bad dates", row });
      continue;
    }

    const code = mapRoomTypeCode(row.roomType);
    const rt = typeByCode.get(code);
    if (!rt) {
      report.skippedInvalid++;
      report.errors.push({
        rsrv: row.rsrv,
        error: `room type ${code} not found for ${row.roomType}`,
      });
      continue;
    }

    const agentId = fuzzyAgentId(row.source, agents || []);
    if (agentId) report.agentMatched++;
    else if (row.source && !isWalkInSource(row.source)) {
      report.agentUnmatchedSources[row.source] =
        (report.agentUnmatchedSources[row.source] || 0) + 1;
    }

    const status = mapStatus(row.section);
    report.byStatus[status] = (report.byStatus[status] || 0) + 1;

    const hasAgent = Boolean(agentId);
    const source = hasAgent ? "agent" : "reservation";
    const pay = paymentMode(row, hasAgent);
    const mealPlan = mapMealPlan(row.rateType);
    const guestName = row.guest || `Guest ${row.rsrv}`;

    const notes = [
      `Imported from eZee (${row.section})`,
      `eZee Rsrv: ${row.rsrv}`,
      row.roomNo ? `eZee room: ${row.roomNo}` : null,
      row.roomType ? `eZee room type: ${row.roomType}` : null,
      row.rateType ? `eZee rate: ${row.rateType}` : null,
      row.source ? `eZee source: ${row.source}` : null,
      row.user ? `eZee user: ${row.user}` : null,
      row.rsrvDate ? `eZee booked: ${row.rsrvDate}` : null,
      `eZee total: Nu ${row.total.toFixed(2)} · paid: Nu ${row.paid.toFixed(2)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const bookingPayload = {
      property_id: propertyId,
      agent_id: agentId,
      source,
      booked_by_role: "reservation",
      status,
      check_in: row.arrival,
      check_out: row.departure,
      contact_name: guestName,
      contact_phone: PLACEHOLDER_PHONE,
      contact_email: null,
      adults: Math.max(1, row.pax || 1),
      children: 0,
      extra_beds: 0,
      rooms: 1,
      guide_number: null,
      guest_origin: hasAgent ? "international" : "local",
      payment_mode: pay,
      notes,
      meal_plan_code: mealPlan,
      meal_plan_amount_btn: 0,
      extra_bed_amount_btn: 0,
      quoted_total_btn: row.total > 0 ? row.total : null,
      token_required_btn: 0,
      token_received_btn: Math.min(row.paid, row.total) || 0,
      channel_source: "ezee",
      external_ref: externalRef,
      confirmed_at: status === "confirmed" || status === "checked_in"
        ? new Date().toISOString()
        : null,
      confirmed_by: "ezee_import",
      cancelled_at:
        status === "cancelled" || status === "no_show"
          ? new Date().toISOString()
          : null,
      cancel_reason:
        status === "cancelled"
          ? row.section
          : status === "no_show"
            ? "no_show"
            : null,
    };

    if (DRY) {
      report.inserted++;
      existSet.add(externalRef);
      continue;
    }

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .insert(bookingPayload)
      .select("id")
      .single();

    if (bErr || !booking) {
      report.errors.push({
        rsrv: row.rsrv,
        error: bErr?.message || "insert failed",
        details: bErr,
      });
      continue;
    }

    const { error: lineErr } = await admin.from("booking_rooms").insert({
      booking_id: booking.id,
      room_type_id: rt.id,
      qty: 1,
      inventory_kind: rt.inventory_kind || "sellable_guest",
    });
    if (lineErr) {
      report.errors.push({
        rsrv: row.rsrv,
        error: "booking_rooms: " + lineErr.message,
        bookingId: booking.id,
      });
      // keep booking — desk can fix lines
    }

    await admin.from("booking_guests").insert({
      booking_id: booking.id,
      full_name: guestName,
    });

    report.inserted++;
    existSet.add(externalRef);

    if (report.inserted % 50 === 0) {
      console.log(`… ${report.inserted} inserted`);
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    dryRun: DRY,
    inserted: report.inserted,
    skippedExisting: report.skippedExisting,
    skippedInvalid: report.skippedInvalid,
    errorCount: report.errors.length,
    agentMatched: report.agentMatched,
    byStatus: report.byStatus,
    unmatchedSources: report.agentUnmatchedSources,
    report: REPORT_PATH,
  }, null, 2));

  if (report.errors.length) {
    console.log("First errors:", report.errors.slice(0, 5));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
