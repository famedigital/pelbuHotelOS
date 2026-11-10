/**
 * Backfill agent payments / dues for property pelbu-olakha from
 * Travel Agent Payment.xlsx. Idempotent on payment idempotency_key and
 * folio charge description tags.
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/pelbu-olakha-import-payments.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-import-payments.mjs --apply
 */

import { createHash } from "node:crypto";
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
  "C:/Users/rajiv/Downloads/Travel Agent Payment  (2).xlsx";

const CHARGE_TAG = "olakha-pay-charge:";
const PAY_TAG = "olakha-pay:";
const AR_TAG = "olakha-pay-ar:";
const NOTE_TAG = "[olakha-pay-backfill]";
const OUTSTANDING_MIN = 0.5;

function excelSerialToIso(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.round(n) * 86400000).toISOString().slice(0, 10);
}

function parseDateCell(value) {
  if (value == null || value === "" || value === "-") return null;
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value).trim())) {
    return excelSerialToIso(value);
  }
  const text = String(value).replace(/\r/g, "").trim();
  const firstLine = text.split("\n")[0].trim();
  const dmY = firstLine.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const [, d, m, y] = dmY;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(firstLine)) return firstLine;
  return null;
}

function parseMultiDates(value) {
  if (value == null || value === "" || value === "-") return [];
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value).trim())) {
    const iso = excelSerialToIso(value);
    return iso ? [iso] : [];
  }
  const text = String(value).replace(/\r/g, "");
  const out = [];
  for (const part of text.split(/\n+/)) {
    const iso = parseDateCell(part.trim());
    if (iso) out.push(iso);
  }
  return out;
}

function num(value) {
  if (value === "" || value === "-" || value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function norm(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function agentKey(name) {
  let s = norm(name);
  s = s
    .replace(/\bjournery\b/g, "journey")
    .replace(/\bbhuan\b/g, "bhutan")
    .replace(/\bsilver pine\b/g, "sliver pine")
    .replace(/\btravellers\b/g, "travelers")
    .replace(/\btours and travels\b/g, "tours")
    .replace(/\btours & treks\b/g, "tours")
    .replace(/\btour\b/g, "tours")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function guestTokens(name) {
  return norm(name)
    .replace(/\b(mr|mrs|ms|miss|group|pax|x\d+|ref)\b/g, " ")
    .split(" ")
    .filter((t) => t.length >= 3);
}

function tokenOverlap(a, b) {
  const ta = new Set(guestTokens(a));
  const tb = new Set(guestTokens(b));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  // Ratio against the shorter side so a short guest name still scores in long notes.
  return hit / Math.min(ta.size, tb.size);
}

function guestMentions(guest, text) {
  const tokens = guestTokens(guest);
  if (!tokens.length || !text) return false;
  const hay = norm(text);
  return tokens.every((t) => hay.includes(t));
}

function mapMethod(status) {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s || s === "not received") return null;
  if (s.includes("cash")) return "cash";
  if (/(mbob|epay|mpay|bank|received)/i.test(s)) return "bank";
  return "bank";
}

/**
 * Sheet Amount Received is sometimes left blank when Payment Status already
 * says cash was taken (e.g. "Cash safe box"). Infer full collection then.
 * Totals on the Olakha sheet are already net payable (Drive ÷ 1.05, no GST).
 */
function normalizeCollection(row) {
  const status = String(row.paymentStatus ?? "").trim().toLowerCase();
  if (!status || status === "not received") return row;
  const impliesCashTaken =
    status.includes("cash") || status.includes("safe box");
  if (
    impliesCashTaken &&
    row.received <= OUTSTANDING_MIN &&
    row.total > OUTSTANDING_MIN &&
    row.outstanding >= row.total - OUTSTANDING_MIN
  ) {
    return {
      ...row,
      received: row.total,
      outstanding: 0,
      flags: [...(row.flags || []), "recv_inferred_from_status"],
    };
  }
  return row;
}

function paymentMode(received, outstanding, total) {
  const due = round2(outstanding);
  const recv = round2(received);
  if (due <= OUTSTANDING_MIN && recv > 0) return "prepaid";
  if (recv > 0 && due > OUTSTANDING_MIN) return "partial";
  if (due > OUTSTANDING_MIN) return "on_credit";
  if (total > 0 && recv <= 0) return "on_credit";
  return "cash";
}

/** Stable stay identity (excludes received — collection updates must not re-charge). */
function identityKey(row) {
  const raw = [
    row.agent,
    row.guest,
    row.cin,
    row.cout,
    String(row.total),
    row.month,
    row.segment ?? "",
  ].join("|");
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

function rowKey(row) {
  // Prefer identity; keep received out so Cash-safe-box updates reuse the charge tag.
  return identityKey(row);
}

function coerceBadDates(row) {
  const flags = [];
  let { cin, cout } = row;
  // Excel serials that landed in 2027 for Sep sheet rows → coerce to 2026.
  if (cin && cin.startsWith("2027-")) {
    cin = `2026-${cin.slice(5)}`;
    flags.push("cin_year_coerced_2026");
  }
  if (cout && cout.startsWith("2027-")) {
    cout = `2026-${cout.slice(5)}`;
    flags.push("cout_year_coerced_2026");
  }
  // Vacation Adda: nights=22, cout was 2026-09-28, cin wrongly far ahead.
  if (/vacation adda/i.test(row.agent) && cin && cout && cin > cout) {
    const [y, m, d] = cout.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - Math.max(1, Number(row.nights) || 1));
    cin = dt.toISOString().slice(0, 10);
    flags.push("cin_from_nights");
  }
  // Hotel Asura / Kuenga odd serial pairs: if nights small and cin>cout after coerce, swap logic
  if (cin && cout && cin > cout && Number(row.nights) <= 7) {
    const [y, m, d] = cout.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - Math.max(1, Number(row.nights) || 1));
    cin = dt.toISOString().slice(0, 10);
    flags.push("cin_rebuilt_from_cout");
  }
  return { ...row, cin, cout, flags: [...(row.flags || []), ...flags] };
}

function sheetRecords(path) {
  const files = readZip(readFileSync(path));
  const strings = sharedStrings(
    files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "<sst></sst>",
  );
  const sheet = workbookSheets(files)[0];
  const rows = rowsFromCells(
    sheetCells(files.get(sheet.path).toString("utf8"), strings),
  );

  let month = null;
  const records = [];
  for (const r of rows) {
    const c1 = String(r[1] ?? "");
    if (c1.includes("Month of")) {
      month = c1.replace("Month of", "").trim();
      continue;
    }
    if (String(r[0] ?? "").includes("Travel Agent") && String(r[1] ?? "").includes("Guest")) {
      continue;
    }
    if (c1.includes("Travel Agent Payment")) continue;
    const agent = String(r[0] ?? "").trim();
    if (!agent) continue;

    const cinDates = parseMultiDates(r[4]);
    const coutDates = parseMultiDates(r[5]);
    const base = {
      month,
      agent,
      guest: String(r[1] ?? "").trim(),
      nationality: String(r[2] ?? "").trim(),
      meal: String(r[3] ?? "")
        .replace(/\n/g, " ")
        .trim(),
      nights: num(r[6]),
      rooms: String(r[7] ?? "").trim(),
      roomAmt: num(r[8]),
      extras: num(r[9]),
      total: round2(num(r[10])),
      received: round2(num(r[11])),
      outstanding: round2(num(r[12])),
      paymentStatus: String(r[13] ?? "").trim(),
      bookingStatus: String(r[14] ?? "").trim(),
      contact: String(r[15] ?? "").trim(),
      remarks: String(r[16] ?? "")
        .replace(/\n/g, " | ")
        .trim(),
      flags: [],
    };

    if (cinDates.length > 1 && coutDates.length > 1 && cinDates.length === coutDates.length) {
      // Dual-date Yak-style rows: expand into segments; amounts stay full on each
      // only when we cannot split — prefer first segment carries money.
      for (let i = 0; i < cinDates.length; i += 1) {
        const seg = coerceBadDates({
          ...base,
          cin: cinDates[i],
          cout: coutDates[i],
          segment: String(i + 1),
          total: i === 0 ? base.total : 0,
          received: i === 0 ? base.received : 0,
          outstanding: i === 0 ? base.outstanding : 0,
          flags: [...base.flags, "multi_date_segment"],
        });
        // Secondary segments still match for presence but skip money if total=0
        records.push(seg);
      }
    } else {
      records.push(
        normalizeCollection(
          coerceBadDates({
            ...base,
            cin: cinDates[0] ?? parseDateCell(r[4]),
            cout: coutDates[0] ?? parseDateCell(r[5]),
          }),
        ),
      );
    }
  }
  return records
    .map((row) =>
      row.flags?.includes("multi_date_segment")
        ? normalizeCollection(row)
        : row,
    )
    .filter(
      (row) =>
        row.total > 0 ||
        row.received > 0 ||
        row.outstanding > 0 ||
        row.flags.includes("multi_date_segment"),
    );
}

function scoreMatch(row, booking, agentName) {
  let score = 0;
  const reasons = [];
  if (row.cin && booking.check_in === row.cin) {
    score += 40;
    reasons.push("cin");
  } else if (row.cin && booking.check_in) {
    const d = Math.abs(
      (Date.parse(row.cin) - Date.parse(booking.check_in)) / 86400000,
    );
    if (d === 1) {
      score += 25;
      reasons.push("cin±1");
    } else if (d === 2) {
      score += 10;
      reasons.push("cin±2");
    }
  }
  if (row.cout && booking.check_out === row.cout) {
    score += 30;
    reasons.push("cout");
  } else if (row.cout && booking.check_out) {
    const d = Math.abs(
      (Date.parse(row.cout) - Date.parse(booking.check_out)) / 86400000,
    );
    if (d === 1) {
      score += 18;
      reasons.push("cout±1");
    }
  }

  const sheetAgent = agentKey(row.agent);
  const bookAgent = agentKey(agentName || "");
  // Ignore numeric "agent names" (room labels wrongly stored as company_name).
  const bookAgentUsable = bookAgent && !/^\d+$/.test(bookAgent);
  if (sheetAgent && bookAgentUsable) {
    if (sheetAgent === bookAgent) {
      score += 25;
      reasons.push("agent");
    } else if (sheetAgent.includes(bookAgent) || bookAgent.includes(sheetAgent)) {
      score += 18;
      reasons.push("agent~");
    } else {
      const overlap = tokenOverlap(sheetAgent, bookAgent);
      if (overlap >= 0.5) {
        score += 12;
        reasons.push("agent_tok");
      }
    }
  }

  const rackCode = rackAgentCode(booking.external_ref);
  const aliases = codesForAgent(row.agent);
  if (rackCode && aliases.includes(rackCode)) {
    score += 28;
    reasons.push("code");
  }

  const guestScore = Math.max(
    tokenOverlap(row.guest, booking.contact_name || ""),
    tokenOverlap(row.guest, booking.guest_name || ""),
  );
  const inNotes = guestMentions(row.guest, booking.notes || "");
  if (guestScore >= 0.5 || inNotes) {
    score += Math.round(22 * Math.max(guestScore, inNotes ? 1 : 0));
    reasons.push("guest");
  } else if (!row.guest && (reasons.includes("agent") || reasons.includes("code"))) {
    score += 5;
    reasons.push("empty_guest");
  }

  // Sheet agent name appears in booking notes (rack comment) even when agents.company_name is wrong.
  if (sheetAgent && booking.notes) {
    const noteKey = agentKey(booking.notes);
    if (noteKey.includes(sheetAgent) || sheetAgent.split(" ").every((w) => w.length < 3 || noteKey.includes(w))) {
      if (!reasons.includes("code") && !reasons.includes("agent")) {
        score += 16;
        reasons.push("notes_agent");
      }
    }
  }

  if (row.nights && booking.check_in && booking.check_out) {
    const nights =
      (Date.parse(booking.check_out) - Date.parse(booking.check_in)) / 86400000;
    if (Math.abs(nights - Number(row.nights)) < 0.01) {
      score += 5;
      reasons.push("nights");
    }
  }

  return { score, reasons };
}

const THRESHOLD = 55;
const AMBIGUOUS_GAP = 8;

/** Sheet agent name → rack external_ref agent-code slugs. */
const AGENT_CODE_ALIASES = {
  "journey dmc": ["jdmc", "jdmcb"],
  "journery dmc": ["jdmc", "jdmcb"],
  "little bhutan": ["lb"],
  "tandin bhutan travel": ["tbt"],
  "bk tours and travels": ["bk"],
  "bk tours": ["bk"],
  "travel finder tour": ["tft"],
  "travel finder tours": ["tft"],
  "southeast himalaya adventure": ["sha"],
  "uni asia": ["uni-asia", "uniasia", "uni"],
  "kuenga tours": ["kttb", "kuenga"],
  "bhutan riwong tours and travels": ["brtt", "riwong"],
  "bhuan sliver pine": ["ceo", "sp", "silver-pine"],
  "silver pine": ["ceo", "sp"],
  "alliance international tours and travels": ["aitt"],
  "alliance international tours": ["aitt"],
  "bhutan yeegaa tours treks": ["bytt", "yeegaa"],
  "maya himalaya travels": ["mht"],
  "crane valley tours treks": ["cvt"],
  "yak holidays": ["yhi"],
  "golden vacation siliguri": ["gv"],
  "bhutan tourer": ["bt"],
  "kuenshey tours": ["kt"],
  "excursion to himalayas": ["eth"],
  "bhutan travelers": ["bt"],
  "bhutan travellers": ["bht"],
  "trekking in bhutan": ["tib", "tb", "bht"],
  "druk sakura tours": ["dst"],
  "active bhutan tours treks": ["abtt"],
  "glimpse of drukyul": ["god"],
  "aaraya village tours": ["avt"],
  "soultrips": ["st"],
  "destiny bhutan": ["db"],
  "mr cheki dorji": ["cd", "cheki"],
  "vacation adda": ["va"],
  "hotel asura 1pax": ["ha", "asura"],
  "amazing dragon holidays": ["adh"],
  "dainty tours travels": ["dtt"],
  "dainty tours": ["dtt"],
};

function codesForAgent(agentName) {
  const key = agentKey(agentName);
  if (AGENT_CODE_ALIASES[key]) return AGENT_CODE_ALIASES[key];
  // soft: first letters of significant words
  const words = key
    .split(" ")
    .filter(
      (w) =>
        !["tours", "treks", "travels", "travel", "holidays", "adventure", "international"].includes(
          w,
        ),
    );
  const initials = words.map((w) => w[0]).join("");
  return initials ? [initials, words.join("-").slice(0, 12)] : [];
}

function rackAgentCode(externalRef) {
  const m = String(externalRef || "").match(/^rack:\d+:([^:]+):/);
  return m ? m[1].toLowerCase() : "";
}

async function fetchAllBookings(db, propertyId) {
  const pageSize = 1000;
  let offset = 0;
  const all = [];
  for (;;) {
    const batch = await db.select(
      `bookings?select=id,external_ref,agent_id,contact_name,check_in,check_out,status,quoted_total_btn,token_received_btn,payment_mode,notes,rooms,adults&property_id=eq.${propertyId}&order=check_in.asc&limit=${pageSize}&offset=${offset}`,
    );
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function fetchGuests(db, bookingIds) {
  const map = new Map();
  const chunk = 80;
  for (let i = 0; i < bookingIds.length; i += chunk) {
    const ids = bookingIds.slice(i, i + chunk);
    const rows = await db.select(
      `booking_guests?select=booking_id,full_name&booking_id=in.(${ids.join(",")})&order=sort_order.asc`,
    );
    for (const row of rows) {
      if (!map.has(row.booking_id)) map.set(row.booking_id, row.full_name);
    }
  }
  return map;
}

async function fetchAgents(db, agentIds) {
  const map = new Map();
  const unique = [...new Set(agentIds.filter(Boolean))];
  const chunk = 80;
  for (let i = 0; i < unique.length; i += chunk) {
    const ids = unique.slice(i, i + chunk);
    const rows = await db.select(
      `agents?select=id,company_name,credit_used&id=in.(${ids.join(",")})`,
    );
    for (const row of rows) map.set(row.id, row);
  }
  return map;
}

function pickMatch(scored) {
  if (!scored.length || scored[0].score < THRESHOLD) return null;
  if (scored.length === 1) return scored[0];
  let best = scored[0];
  let second = scored[1];
  // Prefer a guest-name hit when the top two are close (agent label quality can skew scores).
  if (
    !best.reasons.includes("guest") &&
    second.reasons.includes("guest") &&
    best.score - second.score <= AMBIGUOUS_GAP
  ) {
    best = second;
    second = scored[0];
  }
  const gap = best.score - second.score;
  if (gap >= AMBIGUOUS_GAP) return best;
  const bestGuest = best.reasons.includes("guest");
  const secondGuest = second.reasons.includes("guest");
  const bestCode = best.reasons.includes("code");
  const secondCode = second.reasons.includes("code");
  if (bestGuest && !secondGuest) return best;
  if (bestCode && !secondCode && !(secondGuest && !bestGuest)) return best;
  if (bestGuest && bestCode && gap >= 3) return best;
  if (gap >= 5 && (bestGuest || bestCode)) return best;
  if (second.score < THRESHOLD) return best;
  return null;
}

function matchRow(row, bookings, agentsById) {
  const scored = [];
  for (const booking of bookings) {
    const agent = booking.agent_id ? agentsById.get(booking.agent_id) : null;
    const { score, reasons } = scoreMatch(
      row,
      booking,
      agent?.company_name || "",
    );
    if (score >= 30) scored.push({ booking, score, reasons, agent });
  }
  scored.sort((a, b) => b.score - a.score);
  const picked = pickMatch(scored);
  if (!picked) {
    if (!scored.length || scored[0].score < THRESHOLD) {
      return { status: "unmatched", candidates: scored.slice(0, 3) };
    }
    return { status: "ambiguous", candidates: scored.slice(0, 3) };
  }
  return {
    status: "matched",
    match: picked,
    candidates: scored.slice(0, 3),
  };
}

async function ensureFolio(db, propertyId, booking, apply) {
  const existing = await db.select(
    `folios?select=id,status,folio_type&booking_id=eq.${booking.id}&folio_type=eq.guest&order=created_at.asc&limit=1`,
  );
  if (existing[0]) return existing[0];
  if (!apply) return { id: null, status: "open", pending: true };
  const inserted = await db.insert("folios", {
    property_id: propertyId,
    booking_id: booking.id,
    folio_type: "guest",
    label: booking.contact_name || booking.external_ref || "Guest folio",
    status: booking.status === "checked_out" ? "closed" : "open",
    closed_at:
      booking.status === "checked_out"
        ? `${booking.check_out}T06:00:00+06:00`
        : null,
  });
  return inserted[0];
}

function chargeDescription(key) {
  return `Agent stay charge (payment sheet) · ${CHARGE_TAG}${key}`;
}

function arNote(key) {
  return `Outstanding from payment sheet · ${AR_TAG}${key}`;
}

async function chargeExists(db, folioId, key) {
  if (!folioId) return false;
  const exact = await db.select(
    `folio_lines?select=id&folio_id=eq.${folioId}&source_type=eq.adjustment&description=like.${encodeURIComponent(`*${CHARGE_TAG}${key}*`)}&limit=1`,
  );
  if (exact[0]) return true;
  // Legacy keys included received in the hash — accept any sheet charge on this folio.
  const legacy = await db.select(
    `folio_lines?select=id&folio_id=eq.${folioId}&source_type=eq.adjustment&description=like.${encodeURIComponent(`*${CHARGE_TAG}*`)}&limit=1`,
  );
  return Boolean(legacy[0]);
}

async function paymentExists(db, propertyId, key, bookingId, received) {
  const byKey = await db.select(
    `payments?select=id&property_id=eq.${propertyId}&idempotency_key=eq.${encodeURIComponent(`${PAY_TAG}${key}`)}&limit=1`,
  );
  if (byKey[0]) return byKey[0];
  if (!bookingId || !(received > OUTSTANDING_MIN)) return null;
  // Legacy idempotency keys hashed received into the tag — match by booking + amount.
  const legacy = await db.select(
    `payments?select=id,amount_btn,idempotency_key&property_id=eq.${propertyId}&booking_id=eq.${bookingId}&idempotency_key=like.${encodeURIComponent(`${PAY_TAG}*`)}&limit=40`,
  );
  const hit = legacy.find(
    (p) => Math.abs(Number(p.amount_btn ?? 0) - received) <= OUTSTANDING_MIN,
  );
  return hit ?? null;
}

async function arExists(db, propertyId, bookingId, key) {
  const exact = await db.select(
    `agent_credit_ledger?select=id&property_id=eq.${propertyId}&booking_id=eq.${bookingId}&entry_type=eq.charge&note=eq.${encodeURIComponent(arNote(key))}&limit=1`,
  );
  if (exact[0]) return true;
  const legacy = await db.select(
    `agent_credit_ledger?select=id&property_id=eq.${propertyId}&booking_id=eq.${bookingId}&entry_type=eq.charge&note=like.${encodeURIComponent(`*${AR_TAG}*`)}&limit=1`,
  );
  return Boolean(legacy[0]);
}

async function applyRow(db, propertyId, row, match, apply) {
  const key = rowKey(row);
  const booking = match.booking;
  const agent = match.agent;
  const result = {
    key,
    status: "applied",
    bookingId: booking.id,
    external_ref: booking.external_ref,
    actions: [],
  };

  // Secondary multi-date segments with zero money: match-only, no write.
  if (row.total <= 0 && row.received <= 0 && row.outstanding <= 0) {
    result.status = "matched_no_money";
    return result;
  }

  const mode = paymentMode(row.received, row.outstanding, row.total);
  const method = mapMethod(row.paymentStatus) || (row.received > 0 ? "bank" : null);
  const noteBits = [
    NOTE_TAG,
    `key=${key}`,
    row.paymentStatus ? `status=${row.paymentStatus}` : null,
    row.remarks || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const existingPay = await paymentExists(
    db,
    propertyId,
    key,
    booking.id,
    row.received,
  );
  const folio = await ensureFolio(db, propertyId, booking, apply);
  const hasCharge =
    folio.id && row.total > 0 ? await chargeExists(db, folio.id, key) : row.total <= 0;
  const needsAr = Boolean(agent && row.outstanding > OUTSTANDING_MIN);
  const hasAr = needsAr
    ? await arExists(db, propertyId, booking.id, key)
    : true;
  const payDone = row.received <= 0 || Boolean(existingPay);
  const chargeDone = row.total <= 0 || hasCharge;

  if (payDone && chargeDone && hasAr) {
    result.status = "already_applied";
    return result;
  }

  if (!apply) {
    result.status = "would_apply";
    result.actions.push(
      `booking quoted=${row.total} recv=${row.received} mode=${mode}`,
      folio.id ? "folio:exists" : "folio:create",
      row.total > 0 && !hasCharge ? `charge:${row.total}` : null,
      row.received > 0 && !existingPay ? `pay:${row.received}:${method}` : null,
      row.outstanding > OUTSTANDING_MIN && agent && !hasAr
        ? `ar:${row.outstanding}`
        : null,
    );
    result.actions = result.actions.filter(Boolean);
    return result;
  }

  const prevNotes = booking.notes || "";
  const notes = prevNotes.includes(NOTE_TAG)
    ? prevNotes
    : [prevNotes, noteBits].filter(Boolean).join("\n\n").slice(0, 8000);

  await db.update(`bookings?id=eq.${booking.id}`, {
    quoted_total_btn: row.total > 0 ? row.total : booking.quoted_total_btn,
    token_received_btn: row.received,
    payment_mode: mode,
    notes,
  });
  result.actions.push("booking_updated");

  let folioId = folio.id;
  if (!folioId) {
    const created = await ensureFolio(db, propertyId, booking, true);
    folioId = created.id;
    result.actions.push("folio_created");
  }

  // Sheet totals are Drive package ÷ 1.05 (SC kept, 5% GST removed — not GST-registered).
  if (row.total > 0 && !(await chargeExists(db, folioId, key))) {
    await db.insert("folio_lines", {
      folio_id: folioId,
      booking_id: booking.id,
      source_type: "adjustment",
      description: `${chargeDescription(key)} · less 5% GST (not GST-registered)`,
      qty: 1,
      unit_price_btn: row.total,
      amount_btn: row.total,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: row.total,
      status: "posted",
      bill_to: agent ? "agent" : "guest",
      bill_to_reason: agent
        ? "olakha payment sheet · net of GST"
        : null,
    });
    result.actions.push(`charge:${row.total}`);
  }

  // Re-open settled/closed folio when posting a collection update.
  if (row.received > 0 && folioId && !existingPay) {
    await db.update(`folios?id=eq.${folioId}`, {
      status: "open",
      closed_at: null,
    });
  }

  if (row.received > 0 && !existingPay) {
    const payRows = await db.insert("payments", {
      property_id: propertyId,
      folio_id: folioId,
      booking_id: booking.id,
      method: method || "bank",
      kind: "settlement",
      amount_btn: row.received,
      reference: row.remarks ? row.remarks.slice(0, 200) : row.paymentStatus || null,
      notes: noteBits,
      idempotency_key: `${PAY_TAG}${key}`,
      confirmation_status: "confirmed",
    });
    const paymentId = payRows[0].id;
    await db.insert("folio_lines", {
      folio_id: folioId,
      booking_id: booking.id,
      source_type: "payment",
      source_id: paymentId,
      description: `Payment · ${method || "bank"}${row.remarks ? ` · ${row.remarks.slice(0, 80)}` : ""}`,
      qty: 1,
      unit_price_btn: -row.received,
      amount_btn: -row.received,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: -row.received,
      status: "posted",
    });
    result.actions.push(`pay:${row.received}`);
    result.paymentId = paymentId;
  } else if (existingPay) {
    result.actions.push("pay:already");
    result.paymentId = existingPay.id;
  }

  if (row.outstanding > OUTSTANDING_MIN && agent && !(await arExists(db, propertyId, booking.id, key))) {
    const used = round2(Number(agent.credit_used ?? 0));
    const nextUsed = round2(used + row.outstanding);
    await db.update(`agents?id=eq.${agent.id}`, { credit_used: nextUsed });
    const links = await db.select(
      `agent_property_links?select=agent_id,property_id,credit_used&agent_id=eq.${agent.id}&property_id=eq.${propertyId}&limit=1`,
    );
    if (links[0]) {
      await db.update(
        `agent_property_links?agent_id=eq.${agent.id}&property_id=eq.${propertyId}`,
        { credit_used: round2(Number(links[0].credit_used ?? 0) + row.outstanding) },
      );
    }
    await db.insert("agent_credit_ledger", {
      property_id: propertyId,
      agent_id: agent.id,
      booking_id: booking.id,
      payment_id: null,
      entry_type: "charge",
      amount_btn: row.outstanding,
      balance_after_btn: nextUsed,
      note: arNote(key),
    });
    agent.credit_used = nextUsed;
    result.actions.push(`ar:${row.outstanding}`);
  }

  // Collection update: clear prior sheet AR when outstanding is now settled.
  if (
    row.outstanding <= OUTSTANDING_MIN &&
    row.received > OUTSTANDING_MIN &&
    agent &&
    (await arExists(db, propertyId, booking.id, key))
  ) {
    const prior = await db.select(
      `agent_credit_ledger?select=id,amount_btn,entry_type&property_id=eq.${propertyId}&booking_id=eq.${booking.id}&note=like.${encodeURIComponent(`*${AR_TAG}*`)}&limit=20`,
    );
    const openCharge = prior
      .filter((e) => e.entry_type === "charge")
      .reduce((s, e) => s + Number(e.amount_btn ?? 0), 0);
    const alreadyPaid = prior
      .filter((e) => e.entry_type === "payment")
      .reduce((s, e) => s + Number(e.amount_btn ?? 0), 0);
    const clearAmt = round2(Math.max(0, openCharge - alreadyPaid));
    if (clearAmt > OUTSTANDING_MIN) {
      const used = round2(Number(agent.credit_used ?? 0));
      const nextUsed = round2(Math.max(0, used - clearAmt));
      await db.update(`agents?id=eq.${agent.id}`, { credit_used: nextUsed });
      const links = await db.select(
        `agent_property_links?select=agent_id,property_id,credit_used&agent_id=eq.${agent.id}&property_id=eq.${propertyId}&limit=1`,
      );
      if (links[0]) {
        await db.update(
          `agent_property_links?agent_id=eq.${agent.id}&property_id=eq.${propertyId}`,
          {
            credit_used: round2(
              Math.max(0, Number(links[0].credit_used ?? 0) - clearAmt),
            ),
          },
        );
      }
      await db.insert("agent_credit_ledger", {
        property_id: propertyId,
        agent_id: agent.id,
        booking_id: booking.id,
        payment_id: result.paymentId ?? null,
        entry_type: "payment",
        amount_btn: clearAmt,
        balance_after_btn: nextUsed,
        note: `Collection from payment sheet · ${AR_TAG}${key}`,
      });
      agent.credit_used = nextUsed;
      result.actions.push(`ar_clear:${clearAmt}`);
    }
  }

  if (row.outstanding <= OUTSTANDING_MIN && row.received > 0 && folioId) {
    await db.update(`folios?id=eq.${folioId}`, {
      status: "settled",
      closed_at: new Date().toISOString(),
    });
    result.actions.push("folio_settled");
  }

  return result;
}

// --- main ---
const sheetRows = sheetRecords(workbookPath);
const db = restClient();

const practice = await db.select(
  `properties?select=id,slug&slug=eq.${PRACTICE_SLUG}`,
);
const properties = await db.select(
  `properties?select=id,slug,name&slug=eq.${PROPERTY_SLUG}`,
);
const property = properties[0];
if (!property || property.slug !== PROPERTY_SLUG) {
  throw new Error(
    `Property ${PROPERTY_SLUG} was not found. Run the provision script first.`,
  );
}
if (practice[0] && practice[0].id === property.id) {
  throw new Error("Refusing to import into the practice property.");
}

const bookings = await fetchAllBookings(db, property.id);
const guestMap = await fetchGuests(
  db,
  bookings.map((b) => b.id),
);
for (const b of bookings) {
  b.guest_name = guestMap.get(b.id) || "";
}
const agentsById = await fetchAgents(
  db,
  bookings.map((b) => b.agent_id),
);

const summary = {
  apply: APPLY,
  property: property.slug,
  propertyId: property.id,
  sheetRows: sheetRows.length,
  matched: 0,
  would_apply: 0,
  applied: 0,
  already_applied: 0,
  matched_no_money: 0,
  unmatched: 0,
  ambiguous: 0,
  failed: 0,
  sumTotal: 0,
  sumReceived: 0,
  sumOutstanding: 0,
  appliedReceived: 0,
  appliedOutstanding: 0,
  unmatchedOutstanding: 0,
  rows: [],
};

for (const row of sheetRows) {
  summary.sumTotal += row.total;
  summary.sumReceived += row.received;
  summary.sumOutstanding += row.outstanding;

  const keyed = { ...row, key: rowKey(row) };
  const decision = matchRow(row, bookings, agentsById);

  if (decision.status === "unmatched") {
    summary.unmatched += 1;
    summary.unmatchedOutstanding += row.outstanding;
    summary.rows.push({
      status: "unmatched",
      agent: row.agent,
      guest: row.guest,
      cin: row.cin,
      cout: row.cout,
      total: row.total,
      received: row.received,
      outstanding: row.outstanding,
      paymentStatus: row.paymentStatus,
      flags: row.flags,
      top: decision.candidates.map((c) => ({
        score: c.score,
        reasons: c.reasons,
        external_ref: c.booking.external_ref,
        contact: c.booking.contact_name,
        cin: c.booking.check_in,
        cout: c.booking.check_out,
        agent: c.agent?.company_name,
      })),
    });
    continue;
  }

  if (decision.status === "ambiguous") {
    summary.ambiguous += 1;
    summary.rows.push({
      status: "ambiguous",
      agent: row.agent,
      guest: row.guest,
      cin: row.cin,
      cout: row.cout,
      total: row.total,
      received: row.received,
      outstanding: row.outstanding,
      flags: row.flags,
      candidates: decision.candidates.map((c) => ({
        score: c.score,
        reasons: c.reasons,
        external_ref: c.booking.external_ref,
        contact: c.booking.contact_name,
        cin: c.booking.check_in,
        cout: c.booking.check_out,
        agent: c.agent?.company_name,
      })),
    });
    continue;
  }

  summary.matched += 1;
  try {
    const applied = await applyRow(
      db,
      property.id,
      keyed,
      decision.match,
      APPLY,
    );
    summary[applied.status] = (summary[applied.status] || 0) + 1;
    if (applied.status === "applied" || applied.status === "already_applied") {
      summary.appliedReceived += row.received;
      summary.appliedOutstanding += row.outstanding;
    }
    if (applied.status === "would_apply") {
      summary.appliedReceived += row.received;
      summary.appliedOutstanding += row.outstanding;
    }
    summary.rows.push({
      status: applied.status,
      agent: row.agent,
      guest: row.guest,
      cin: row.cin,
      cout: row.cout,
      total: row.total,
      received: row.received,
      outstanding: row.outstanding,
      paymentStatus: row.paymentStatus,
      flags: row.flags,
      bookingId: applied.bookingId,
      external_ref: applied.external_ref,
      score: decision.match.score,
      reasons: decision.match.reasons,
      actions: applied.actions,
      matchAgent: decision.match.agent?.company_name,
    });
  } catch (error) {
    summary.failed += 1;
    summary.rows.push({
      status: "failed",
      agent: row.agent,
      guest: row.guest,
      cin: row.cin,
      cout: row.cout,
      error: error.message,
      external_ref: decision.match.booking.external_ref,
    });
    console.error(
      `fail ${row.agent} ${row.cin}: ${error.message}`,
    );
  }
}

// Round summary money
for (const k of [
  "sumTotal",
  "sumReceived",
  "sumOutstanding",
  "appliedReceived",
  "appliedOutstanding",
  "unmatchedOutstanding",
]) {
  summary[k] = round2(summary[k]);
}

console.log(JSON.stringify(summary, null, 2));
