/**
 * Month-wise Aug / Sep / Oct:
 *   - Invoiced + paid
 *   - Invoiced + unpaid
 *   - Not invoiced (+ amount / missing amount)
 * With agent name, phone, client.
 *
 *   node --env-file=.env.local scripts/pelbu-olakha-month-segregate.mjs
 */
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { parseRack, parseComment } from "./lib/pelbu-olakha-rack.mjs";
import {
  readZip,
  rowsFromCells,
  sharedStrings,
  sheetCells,
  workbookSheets,
} from "./lib/xlsx-lite.mjs";

const TODAY = "2026-10-17";
const RACK_PATH = "C:/Users/rajiv/Downloads/Reservation 2026.xlsx";
const PAY_PATH = "C:/Users/rajiv/Downloads/Travel Agent Payment  (2).xlsx";
const OUT =
  process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : "C:/Users/rajiv/Downloads/Pelbu-Olakha-Monthwise-Aug-Sep-Oct.xlsx";

const MONTHS = [
  { key: "2026-08", label: "AUG", sheet: "AUG" },
  { key: "2026-09", label: "SEP", sheet: "SEP" },
  { key: "2026-10", label: "OCT", sheet: "OCT" },
];

const CODE_NAMES = {
  wig: "Walk-in Guest",
  wih: "Walk-in Guest",
  tl: "Travel & Living",
  sha: "Southeast Himalaya Adventures",
  st: "Soultrips",
  soultrips: "Soultrips",
  lb: "Little Bhutan",
  littl: "Little Bhutan",
};

/** Merge spelling variants so rate history pools correctly. */
function agentCanon(key) {
  let k = normAgent(key);
  if (!k) return "";
  if (/^journey\s*dmc|^journeydmc/.test(k)) return "journey dmc";
  if (/^little?\s*bhutan|^littl\s*bhutan|^lb$/.test(k)) return "little bhutan";
  if (/^yak\s*holidays?/.test(k)) return "yak holidays";
  if (/^soul\s*trips?|^soultrips|^st$/.test(k)) return "soultrips";
  if (/^travel\s*(and|&)?\s*living|^tl$/.test(k)) return "travel living";
  if (/^trekking[\s-]*in[\s-]*bhutan/.test(k)) return "trekking in bhutan";
  if (/^silver\s*pine/.test(k)) return "silver pine";
  if (/^dainty\s*tours/.test(k)) return "dainty tours travels";
  if (/^amazing\s*dragon/.test(k)) return "amazing dragon holidays";
  if (/^bhutan\s*riwong/.test(k)) return "bhutan riwong";
  if (/^southeast\s*himalaya|^sha$/.test(k)) return "southeast himalaya adventures";
  return k;
}
function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function num(v) {
  if (v === "" || v === "-" || v == null) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function excelSerialToIso(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
    .toISOString()
    .slice(0, 10);
}
function normAgent(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/journery/g, "journey")
    .replace(/bhuan/g, "bhutan")
    .replace(/sliver/g, "silver")
    .replace(/travellers/g, "travelers")
    .replace(/soul\s*trips?/g, "soultrips")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normGuest(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function nightsBetween(cin, cout) {
  if (!cin || !cout) return 0;
  const n = Math.max(0, (Date.parse(cout) - Date.parse(cin)) / 86400000);
  return Number.isFinite(n) ? n : 0;
}
function phoneFromComment(raw) {
  const text = String(raw || "");
  const wa = [
    ...text.matchAll(
      /(?:whats?app|by\s+whats?app|wa)\s*[:(\[]?\s*(?:\+?975[\s-]*)?(\d{7,10})/gi,
    ),
  ].map((m) => m[1]);
  if (wa.length) return wa[0];
  const intl = [...text.matchAll(/\+975[\s-]*(\d{7,8})\b/g)].map((m) => m[1]);
  if (intl.length) return intl[0];
  return "";
}
function sheetMonthKey(s) {
  const cin = s.cin || "";
  if (/^2026-0[89]|^2026-10/.test(cin)) return cin.slice(0, 7);
  // Fix bad year serials (2027-09 → Sep 2026)
  if (/^2027-09/.test(cin)) return "2026-09";
  const m = String(s.month || "").toLowerCase();
  if (m.includes("aug")) return "2026-08";
  if (m.includes("sep")) return "2026-09";
  if (m.includes("oct")) return "2026-10";
  return cin.slice(0, 7) || "unknown";
}

function readPaymentSheet() {
  const payWb = readZip(readFileSync(PAY_PATH));
  const pStrings = sharedStrings(
    payWb.get("xl/sharedStrings.xml")?.toString("utf8") ?? "<sst></sst>",
  );
  const pRows = rowsFromCells(
    sheetCells(
      payWb.get(workbookSheets(payWb)[0].path).toString("utf8"),
      pStrings,
    ),
  );
  const stays = [];
  let month = null;
  for (const r of pRows) {
    const c1 = String(r[1] ?? "");
    if (c1.includes("Month of")) {
      month = c1.replace("Month of", "").trim();
      continue;
    }
    if (String(r[0] ?? "").includes("Travel Agent")) continue;
    const agent = String(r[0] ?? "").trim();
    if (!agent) continue;
    const total = num(r[10]);
    const received = num(r[11]);
    const outstanding = num(r[12]);
    if (!(total > 0 || received > 0 || outstanding > 0)) continue;
    stays.push({
      month,
      agent,
      key: normAgent(agent),
      guest: String(r[1] ?? "").trim(),
      guestKey: normGuest(r[1]),
      meal: String(r[3] ?? "").replace(/\n/g, " ").trim(),
      cin: excelSerialToIso(r[4]),
      cout: excelSerialToIso(r[5]),
      nights: num(r[6]),
      rooms: String(r[7] ?? "").trim(),
      total,
      received,
      outstanding,
      status: String(r[13] ?? "").trim(),
      remarks: String(r[16] ?? "").replace(/\n/g, " ").trim(),
      used: false,
    });
  }
  return stays;
}

function matchSheet(stay, sheetStays) {
  const key = normAgent(stay.agent);
  const g = normGuest(stay.guest);
  const sameAgent = sheetStays.filter((s) => !s.used && s.key === key);
  let hits = sameAgent.filter(
    (s) => s.cin === stay.cin && (!stay.cout || !s.cout || s.cout === stay.cout),
  );
  if (!hits.length && g) {
    hits = sameAgent.filter(
      (s) =>
        s.cin === stay.cin &&
        (s.guestKey.includes(g.slice(0, 8)) ||
          g.includes(s.guestKey.slice(0, 8))),
    );
  }
  if (!hits.length) hits = sameAgent.filter((s) => s.cin === stay.cin);
  if (!hits.length) return null;
  hits.sort((a, b) => {
    const sa =
      a.guestKey === g ? 0 : a.guestKey.includes(g.slice(0, 6)) ? 1 : 2;
    const sb =
      b.guestKey === g ? 0 : b.guestKey.includes(g.slice(0, 6)) ? 1 : 2;
    return sa - sb;
  });
  return hits[0];
}

async function loadAgentPhones() {
  try {
    const { restClient } = await import("./lib/supabase-rest.mjs");
    const { PROPERTY_SLUG } = await import("./lib/pelbu-olakha-rooms.mjs");
    const db = restClient();
    const props = await db.select(
      `properties?select=id,slug&slug=eq.${PROPERTY_SLUG}`,
    );
    if (!props[0]) return new Map();
    const agents = await db.select(
      `agents?select=id,company_name,contact_phone,contact_name&limit=2000`,
    );
    const map = new Map();
    for (const a of agents) {
      const k = normAgent(a.company_name);
      if (!map.has(k) || a.contact_phone) {
        map.set(k, {
          phone: a.contact_phone || "",
          contact: a.contact_name || "",
        });
      }
    }
    return map;
  } catch (err) {
    console.warn(`ERP phones skipped: ${err.message}`);
    return new Map();
  }
}

function resolveAgentName(s) {
  const agentCode = s.agent_code || "";
  const commentCompany = parseComment(s.raw_comment || "", 2026).company || "";
  let agentName =
    (s.agent_name && s.agent_name !== s.agent_code ? s.agent_name : "") ||
    (commentCompany &&
    !/^walk[\s-]*in/i.test(commentCompany) &&
    normAgent(commentCompany) !== normAgent(agentCode)
      ? commentCompany
      : "") ||
    CODE_NAMES[normAgent(agentCode)] ||
    s.agent_name ||
    agentCode ||
    "Unknown";
  if (commentCompany.includes("/")) {
    agentName = commentCompany.split("/")[0].trim() || agentName;
  }
  if (
    (s.source === "client" || /^wig|wih$/i.test(agentCode)) &&
    (!s.agent_name || s.agent_name === agentCode)
  ) {
    agentName =
      (commentCompany.includes("/")
        ? commentCompany.split("/")[0].trim()
        : "") ||
      CODE_NAMES[normAgent(agentCode)] ||
      "Walk-in Guest";
  }
  return { agentCode, agentName };
}

function styleHeader(row, color = "FF1F4E3D") {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
  row.alignment = { vertical: "middle", wrapText: true };
}
function sectionHeader(ws, title, color) {
  const row = ws.addRow([title]);
  row.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
  ws.mergeCells(row.number, 1, row.number, 14);
  return row;
}
function moneyCols(ws, cols) {
  for (const c of cols) ws.getColumn(c).numFmt = "#,##0.00";
}
function autoWidth(ws) {
  ws.columns.forEach((col) => {
    let w = 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length + 2;
      if (len > w) w = Math.min(40, len);
    });
    col.width = w;
  });
}

const HEADERS = [
  "Agent name",
  "Agent phone",
  "Client name",
  "Rooms",
  "# Rooms",
  "Check-in",
  "Check-out",
  "Nights",
  "Meal",
  "Invoice / amount (Nu)",
  "Paid (Nu)",
  "Unpaid / due (Nu)",
  "Missing amount?",
  "Notes",
];

function addDataRows(ws, rows, tone) {
  for (const r of rows) {
    const row = ws.addRow([
      r.agent_name,
      r.phone,
      r.client,
      r.rooms,
      r.room_count,
      r.cin,
      r.cout,
      r.nights,
      r.meal,
      r.amount || null,
      r.paid || null,
      r.due || null,
      r.missing_amount,
      r.notes,
    ]);
    if (tone === "paid") {
      row.getCell(11).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F8EF" },
      };
    } else if (tone === "unpaid") {
      row.getCell(12).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFDE8E8" },
      };
    } else if (tone === "missing") {
      row.getCell(13).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF3CD" },
      };
    }
  }
}

function buildAgentRateCards(allRackStays, sheetStays) {
  const cards = new Map();
  const touch = (rawKey, displayName) => {
    const key = agentCanon(rawKey);
    if (!key || key === "wig" || key === "walk in guest" || /^\d{3}$/.test(key))
      return null;
    if (!cards.has(key)) {
      cards.set(key, {
        key,
        name: displayName || rawKey,
        rackSamples: [],
        sheetSamples: [],
      });
    }
    return cards.get(key);
  };

  for (const s of allRackStays) {
    if (s.blocking) continue;
    const name = s.agent_name || s.agent_code || "";
    const card = touch(name, name);
    if (!card) continue;
    const q = Number(s.quoted_total_btn || 0) || 0;
    if (!(q > 0)) continue;
    const n = Math.max(1, s.nights?.length || nightsBetween(s.check_in, s.check_out) || 1);
    const doors = Math.max(1, (s.doors || []).length || 1);
    card.rackSamples.push({
      perRn: q / (n * doors),
      total: q,
      n,
      doors,
      cin: s.check_in,
      source: s.amount_source || "comment",
    });
  }
  for (const s of sheetStays) {
    const card = touch(s.agent, s.agent);
    if (!card || !(s.total > 0)) continue;
    const n = Math.max(1, s.nights || nightsBetween(s.cin, s.cout) || 1);
    const doors = Math.max(
      1,
      String(s.rooms || "")
        .split(/[,/]/)
        .map((x) => x.trim())
        .filter(Boolean).length || 1,
    );
    card.sheetSamples.push({
      perRn: s.total / (n * doors),
      total: s.total,
      n,
      doors,
      cin: s.cin,
      source: "payment_sheet",
    });
  }

  for (const card of cards.values()) {
    const sheetMed = median(card.sheetSamples.map((x) => x.perRn));
    const rackMed = median(card.rackSamples.map((x) => x.perRn));
    // Prefer payment-sheet median (actual billed), else rack comments
    card.perRn = sheetMed ?? rackMed;
    card.perRnSource =
      sheetMed != null
        ? `payment sheet median (${card.sheetSamples.length} stays)`
        : rackMed != null
          ? `rack comment median (${card.rackSamples.length} stays)`
          : null;
    card.sampleCount = card.sheetSamples.length + card.rackSamples.length;
  }
  return cards;
}

async function main() {
  const sheetStays = readPaymentSheet();
  const erpPhones = await loadAgentPhones();
  const parsed = parseRack(RACK_PATH, TODAY);
  const rateCards = buildAgentRateCards(parsed.stays, sheetStays);
  const rack = parsed.stays.filter(
    (s) =>
      !s.blocking &&
      s.check_in &&
      s.check_in >= "2026-08-01" &&
      s.check_in < "2026-11-01",
  );

  const allRows = [];
  for (const s of rack) {
    const { agentCode, agentName } = resolveAgentName(s);
    const key = agentCanon(agentName) || agentCanon(agentCode);
    const rooms = s.room_labels || (s.doors || []).join(", ");
    const roomCount = Math.max(
      1,
      (s.doors || []).length ||
        String(rooms)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean).length,
    );
    const n = nightsBetween(s.check_in, s.check_out) || (s.nights?.length ?? 0);
    const quoted =
      s.quoted_total_btn === "" || s.quoted_total_btn == null
        ? 0
        : Number(s.quoted_total_btn) || 0;
    const sheet = matchSheet(
      {
        agent: agentName,
        guest: s.guest_name || "",
        cin: s.check_in,
        cout: s.check_out,
      },
      sheetStays,
    );
    if (sheet) sheet.used = true;

    const erp =
      erpPhones.get(key) ||
      erpPhones.get(agentCanon(agentName)) ||
      erpPhones.get(normAgent(agentCode)) ||
      erpPhones.get(normAgent(agentName)) ||
      [...erpPhones.entries()].find(([k]) => agentCanon(k) === key)?.[1];
    const phone =
      erp?.phone || phoneFromComment(s.raw_comment) || s.guide_phone || "";

    const invoiced = Boolean(sheet && sheet.total > 0.5);
    let amount = invoiced ? sheet.total : quoted;
    let amountSource = invoiced
      ? "payment_sheet"
      : quoted > 0
        ? s.amount_source || "comment"
        : "";
    const paid = sheet?.received ?? 0;
    const due = invoiced
      ? sheet.outstanding > 0
        ? sheet.outstanding
        : Math.max(0, sheet.total - sheet.received)
      : 0;

    // No invoice & no comment total → estimate from same agent's other rates
    let estimated = false;
    const card = rateCards.get(key);
    if (!invoiced && !(amount > 0.5) && card?.perRn && n > 0) {
      amount = Math.round(card.perRn * n * roomCount * 100) / 100;
      amountSource = `same_agent_rate · Nu ${Math.round(card.perRn)}/RN · ${card.perRnSource}`;
      estimated = true;
    }

    let bucket;
    if (invoiced && due <= 0.5 && paid > 0.5) bucket = "invoiced_paid";
    else if (invoiced && due > 0.5) bucket = "invoiced_unpaid";
    else if (invoiced && paid <= 0.5 && due <= 0.5)
      bucket = "invoiced_unpaid";
    else if (estimated) bucket = "estimated_agent_rate";
    else bucket = "not_invoiced";

    const missing_amount =
      amount <= 0.5
        ? "YES — no amount & no agent rate history"
        : estimated
          ? "Estimated from same agent"
          : "No";

    allRows.push({
      month: s.check_in.slice(0, 7),
      agent_code: agentCode,
      agent_name: agentName,
      phone,
      client: s.guest_name || "",
      rooms,
      room_count: roomCount,
      cin: s.check_in,
      cout: s.check_out,
      nights: n,
      meal: s.meal_plan_code || s.meal_as_written || "",
      amount,
      paid: invoiced
        ? paid
        : /payment\s*received|paid|cash given/i.test(
              s.payment_note || s.raw_comment || "",
            )
          ? amount
          : 0,
      due: bucket === "invoiced_unpaid" ? due : 0,
      missing_amount,
      bucket,
      notes: invoiced
        ? `Payment sheet${sheet.status ? ` · ${sheet.status}` : ""}`
        : estimated
          ? `ESTIMATED: ${amountSource}`
          : quoted > 0
            ? `From comment (${amountSource}) — not on invoice sheet`
            : "No invoice, no comment rate, no same-agent history",
      amount_source: amountSource,
      comment: String(s.raw_comment || "").replace(/\n/g, " | ").slice(0, 200),
    });
  }

  // Payment-sheet rows with no rack match (still invoiced)
  for (const s of sheetStays) {
    if (s.used) continue;
    const mk = sheetMonthKey(s);
    if (!MONTHS.some((m) => m.key === mk)) continue;
    const due =
      s.outstanding > 0 ? s.outstanding : Math.max(0, s.total - s.received);
    const bucket =
      due <= 0.5 && s.received > 0.5 ? "invoiced_paid" : "invoiced_unpaid";
    const erp = erpPhones.get(s.key);
    allRows.push({
      month: mk,
      agent_code: "",
      agent_name: s.agent,
      phone: erp?.phone || "",
      client: s.guest,
      rooms: s.rooms,
      room_count: Math.max(
        1,
        String(s.rooms || "")
          .split(/[,/]/)
          .filter(Boolean).length || 1,
      ),
      cin: s.cin || "",
      cout: s.cout || "",
      nights: s.nights || 0,
      meal: s.meal,
      amount: s.total,
      paid: s.received,
      due,
      missing_amount: s.total <= 0.5 ? "YES — no amount" : "No",
      bucket,
      notes: "On payment sheet only (no rack match)",
      comment: s.remarks || "",
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Innora · Pelbu Olakha";

  // Summary
  const sum = wb.addWorksheet("Summary", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sum.addRow([
    "Pelbu Olakha — Month-wise invoiced / paid / unpaid / estimated from same agent",
  ]);
  sum.getRow(1).font = { bold: true, size: 14, color: { argb: "FF1F4E3D" } };
  sum.addRow([
    `As of ${TODAY} · Missing amounts filled from same agent's payment-sheet / comment median Nu per room-night`,
  ]);
  sum.addRow([]);
  styleHeader(
    sum.addRow([
      "Month",
      "Invoiced paid",
      "Paid Nu",
      "Invoiced unpaid",
      "Due Nu",
      "Not invoiced (comment amt)",
      "Comment amt Nu",
      "Estimated from agent rate",
      "Estimated Nu",
      "Still missing",
    ]),
  );

  for (const m of MONTHS) {
    const rows = allRows.filter((r) => r.month === m.key);
    const paid = rows.filter((r) => r.bucket === "invoiced_paid");
    const unpaid = rows.filter((r) => r.bucket === "invoiced_unpaid");
    const notInv = rows.filter(
      (r) => r.bucket === "not_invoiced" && r.amount > 0.5,
    );
    const est = rows.filter((r) => r.bucket === "estimated_agent_rate");
    const missing = rows.filter((r) => r.missing_amount.startsWith("YES"));
    sum.addRow([
      m.label,
      paid.length,
      Math.round(paid.reduce((a, r) => a + r.paid, 0)),
      unpaid.length,
      Math.round(unpaid.reduce((a, r) => a + r.due, 0)),
      notInv.length,
      Math.round(notInv.reduce((a, r) => a + (r.amount || 0), 0)),
      est.length,
      Math.round(est.reduce((a, r) => a + (r.amount || 0), 0)),
      missing.length,
    ]);
  }
  moneyCols(sum, [3, 5, 7, 9]);
  autoWidth(sum);

  // Agent rate card used for estimates
  const ratesWs = wb.addWorksheet("Agent rates used", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(
    ratesWs.addRow([
      "Agent",
      "Rate Nu / room-night",
      "Source",
      "Payment-sheet samples",
      "Rack-comment samples",
    ]),
  );
  for (const card of [...rateCards.values()]
    .filter((c) => c.perRn != null)
    .sort((a, b) => a.name.localeCompare(b.name))) {
    ratesWs.addRow([
      card.name,
      Math.round(card.perRn * 100) / 100,
      card.perRnSource,
      card.sheetSamples.length,
      card.rackSamples.length,
    ]);
  }
  moneyCols(ratesWs, [2]);
  autoWidth(ratesWs);

  for (const m of MONTHS) {
    const rows = allRows
      .filter((r) => r.month === m.key)
      .sort(
        (a, b) =>
          a.cin.localeCompare(b.cin) ||
          a.agent_name.localeCompare(b.agent_name) ||
          a.client.localeCompare(b.client),
      );
    const paid = rows.filter((r) => r.bucket === "invoiced_paid");
    const unpaid = rows.filter((r) => r.bucket === "invoiced_unpaid");
    const notInvAmt = rows.filter(
      (r) => r.bucket === "not_invoiced" && r.amount > 0.5,
    );
    const estimated = rows.filter((r) => r.bucket === "estimated_agent_rate");
    const notInvMissing = rows.filter(
      (r) => r.bucket === "not_invoiced" && r.amount <= 0.5,
    );

    const ws = wb.addWorksheet(m.sheet, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.addRow([
      `${m.label} 2026 — Invoiced / unpaid / comment / estimated from same agent`,
    ]);
    ws.getRow(1).font = { bold: true, size: 13, color: { argb: "FF1F4E3D" } };
    ws.mergeCells("A1:N1");
    ws.addRow([]);

    sectionHeader(
      ws,
      `1) INVOICED + PAID  (${paid.length} stays · Nu ${Math.round(paid.reduce((a, r) => a + r.paid, 0)).toLocaleString()})`,
      "FF1B7A4E",
    );
    styleHeader(ws.addRow(HEADERS), "FF2E8B57");
    addDataRows(ws, paid, "paid");
    ws.addRow([]);

    sectionHeader(
      ws,
      `2) INVOICED + UNPAID  (${unpaid.length} stays · due Nu ${Math.round(unpaid.reduce((a, r) => a + r.due, 0)).toLocaleString()})`,
      "FFB45309",
    );
    styleHeader(ws.addRow(HEADERS), "FFD97706");
    addDataRows(ws, unpaid, "unpaid");
    ws.addRow([]);

    sectionHeader(
      ws,
      `3) NOT INVOICED — amount from THIS stay's comment  (${notInvAmt.length} · Nu ${Math.round(notInvAmt.reduce((a, r) => a + r.amount, 0)).toLocaleString()})`,
      "FF1D4ED8",
    );
    styleHeader(ws.addRow(HEADERS), "FF3B82F6");
    addDataRows(ws, notInvAmt, "not");
    ws.addRow([]);

    sectionHeader(
      ws,
      `4) NOT INVOICED — ESTIMATED from same agent's other rates  (${estimated.length} · Nu ${Math.round(estimated.reduce((a, r) => a + r.amount, 0)).toLocaleString()})`,
      "FF6D28D9",
    );
    styleHeader(ws.addRow(HEADERS), "FF8B5CF6");
    addDataRows(ws, estimated, "missing");
    ws.addRow([]);

    sectionHeader(
      ws,
      `5) STILL MISSING — no comment rate & no same-agent history  (${notInvMissing.length})`,
      "FF991B1B",
    );
    styleHeader(ws.addRow(HEADERS), "FFDC2626");
    addDataRows(ws, notInvMissing, "missing");

    moneyCols(ws, [10, 11, 12]);
    autoWidth(ws);
  }

  // All-in-one flat list for filtering
  const all = wb.addWorksheet("All rows", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(
    all.addRow([
      "Month",
      "Bucket",
      ...HEADERS,
    ]),
  );
  for (const r of allRows.sort(
    (a, b) =>
      a.month.localeCompare(b.month) ||
      a.bucket.localeCompare(b.bucket) ||
      a.cin.localeCompare(b.cin),
  )) {
    all.addRow([
      r.month,
      r.bucket,
      r.agent_name,
      r.phone,
      r.client,
      r.rooms,
      r.room_count,
      r.cin,
      r.cout,
      r.nights,
      r.meal,
      r.amount || null,
      r.paid || null,
      r.due || null,
      r.missing_amount,
      r.notes,
    ]);
  }
  moneyCols(all, [12, 13, 14]);
  autoWidth(all);

  await wb.xlsx.writeFile(OUT);
  const counts = Object.fromEntries(
    MONTHS.map((m) => {
      const rows = allRows.filter((r) => r.month === m.key);
      return [
        m.label,
        {
          invoiced_paid: rows.filter((r) => r.bucket === "invoiced_paid").length,
          invoiced_unpaid: rows.filter((r) => r.bucket === "invoiced_unpaid")
            .length,
          not_invoiced_comment: rows.filter(
            (r) => r.bucket === "not_invoiced" && r.amount > 0.5,
          ).length,
          estimated_from_agent: rows.filter(
            (r) => r.bucket === "estimated_agent_rate",
          ).length,
          estimated_nu: Math.round(
            rows
              .filter((r) => r.bucket === "estimated_agent_rate")
              .reduce((a, r) => a + r.amount, 0),
          ),
          still_missing: rows.filter((r) => r.missing_amount.startsWith("YES"))
            .length,
        },
      ];
    }),
  );
  console.log(
    JSON.stringify(
      {
        out: OUT,
        counts,
        total: allRows.length,
        agents_with_rate: [...rateCards.values()].filter((c) => c.perRn != null)
          .length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
