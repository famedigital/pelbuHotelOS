/**
 * Stay list Aug → today: rooms, agent, client, dates, rate, amount, paid/unpaid, phone.
 *
 *   node --env-file=.env.local scripts/pelbu-olakha-stays-list.mjs
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
const FROM = "2026-08-01";
const RACK_PATH = "C:/Users/rajiv/Downloads/Reservation 2026.xlsx";
const PAY_PATH = "C:/Users/rajiv/Downloads/Travel Agent Payment  (2).xlsx";
const OUT =
  "C:/Users/rajiv/Downloads/Pelbu-Olakha-Stays-Aug-to-Today.xlsx";

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
function nightlyFromComment(raw, quoted, nNights, rooms) {
  const p = parseComment(raw || "", 2026);
  if (p.nightlyRate != null) return p.nightlyRate;
  const n = Math.max(nNights, 1) * Math.max(rooms, 1);
  if (quoted > 0 && n > 0) return Math.round((quoted / n) * 100) / 100;
  return null;
}
function paidLabel(received, outstanding, total, paymentNote) {
  if (outstanding > 0.5) return "Unpaid";
  if (received > 0.5 && outstanding <= 0.5) return "Paid";
  if (total > 0.5 && received <= 0.5 && outstanding <= 0.5) return "Unpaid";
  const note = String(paymentNote || "");
  if (/payment\s*received|paid|cash given|fully paid/i.test(note)) return "Paid";
  if (/collect|to be paid|pending|unpaid|on arrival|on check-?out/i.test(note))
    return "Unpaid";
  return "Unknown";
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
    const cin = excelSerialToIso(r[4]);
    stays.push({
      month,
      agent,
      key: normAgent(agent),
      guest: String(r[1] ?? "").trim(),
      guestKey: normGuest(r[1]),
      meal: String(r[3] ?? "").replace(/\n/g, " ").trim(),
      cin,
      cout: excelSerialToIso(r[5]),
      nights: num(r[6]),
      rooms: String(r[7] ?? "").trim(),
      total,
      received,
      outstanding,
      status: String(r[13] ?? "").trim(),
      remarks: String(r[16] ?? "").replace(/\n/g, " ").trim(),
    });
  }
  return stays;
}

function matchSheet(stay, sheetStays) {
  const key = normAgent(stay.agent);
  const g = normGuest(stay.guest);
  const sameAgent = sheetStays.filter((s) => s.key === key);
  let hits = sameAgent.filter(
    (s) => s.cin === stay.cin && (!stay.cout || !s.cout || s.cout === stay.cout),
  );
  if (!hits.length && g) {
    hits = sameAgent.filter(
      (s) =>
        s.cin === stay.cin &&
        (s.guestKey.includes(g.slice(0, 8)) || g.includes(s.guestKey.slice(0, 8))),
    );
  }
  if (!hits.length) {
    hits = sameAgent.filter((s) => s.cin === stay.cin);
  }
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    // Prefer closest guest name
    hits.sort((a, b) => {
      const sa = a.guestKey === g ? 0 : a.guestKey.includes(g.slice(0, 6)) ? 1 : 2;
      const sb = b.guestKey === g ? 0 : b.guestKey.includes(g.slice(0, 6)) ? 1 : 2;
      return sa - sb;
    });
    return hits[0];
  }
  return null;
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

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E3D" },
  };
  row.alignment = { vertical: "middle", wrapText: true };
}

async function main() {
  const sheetStays = readPaymentSheet();
  const erpPhones = await loadAgentPhones();
  const parsed = parseRack(RACK_PATH, TODAY);
  const stays = parsed.stays.filter(
    (s) =>
      !s.blocking &&
      s.check_in &&
      s.check_in >= FROM &&
      s.check_in <= TODAY,
  );

  const CODE_NAMES = {
    wig: "Walk-in Guest",
    wih: "Walk-in Guest",
    tl: "Travel & Living",
    sha: "Southeast Himalaya Adventures",
    st: "Soultrips",
    soultrips: "Soultrips",
  };

  const rows = stays.map((s) => {
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
    if (/^walk[\s-]*in/i.test(commentCompany) || s.source === "client") {
      if (!s.agent_name || /^wig|wih$/i.test(agentCode)) {
        agentName = commentCompany.includes("/")
          ? commentCompany.split("/")[0].trim() || "Walk-in Guest"
          : CODE_NAMES[normAgent(agentCode)] || "Walk-in Guest";
        // Prefer agency prefix before "Walk-In" e.g. "Southeast Himalaya Adventures/ Walk-In Guest"
        if (commentCompany.includes("/")) {
          agentName = commentCompany.split("/")[0].trim();
        }
      }
    }
    const key = normAgent(agentName) || normAgent(agentCode);
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
    const amount = sheet?.total > 0 ? sheet.total : quoted;
    const received = sheet?.received ?? 0;
    const outstanding = sheet?.outstanding ?? 0;
    const rate = nightlyFromComment(s.raw_comment, amount, n, roomCount);
    const erp =
      erpPhones.get(key) ||
      erpPhones.get(normAgent(agentCode)) ||
      erpPhones.get(normAgent(agentName));
    const phone =
      erp?.phone ||
      phoneFromComment(s.raw_comment) ||
      s.guide_phone ||
      "";
    const payStatus = paidLabel(
      received,
      outstanding,
      sheet?.total ?? 0,
      s.payment_note || s.raw_comment,
    );
    const clientType =
      s.source === "client" || /walk[\s-]*in/i.test(agentName + agentCode)
        ? "Walk-in / client"
        : "Agent";

    return {
      rooms,
      agent_code: agentCode,
      agent_name: agentName,
      client_type: clientType,
      guest: s.guest_name || "",
      check_in: s.check_in,
      check_out: s.check_out,
      nights: n,
      room_count: roomCount,
      meal: s.meal_plan_code || s.meal_as_written || "",
      rate_night: rate,
      amount,
      received,
      outstanding: outstanding > 0 ? outstanding : Math.max(0, amount - received),
      paid_unpaid: payStatus,
      agent_phone: phone,
      sheet_matched: sheet ? "yes" : "no",
      rack_status: s.status || "",
      nationality: s.nationality || "",
      comment: String(s.raw_comment || "").replace(/\n/g, " | ").slice(0, 400),
    };
  });

  rows.sort(
    (a, b) =>
      a.check_in.localeCompare(b.check_in) ||
      a.agent_name.localeCompare(b.agent_name) ||
      a.guest.localeCompare(b.guest),
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Innora · Pelbu Olakha";
  const ws = wb.addWorksheet("Stays Aug–today", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(
    ws.addRow([
      "Rooms",
      "Agent code",
      "Agent name",
      "Client type",
      "Guest / client",
      "Check-in",
      "Check-out",
      "Nights",
      "# Rooms",
      "Meal",
      "Rate / night (Nu)",
      "Amount (Nu)",
      "Paid (Nu)",
      "Due (Nu)",
      "Paid / Unpaid",
      "Agent phone",
      "Matched payment sheet",
      "Rack status",
      "Nationality",
      "Comment excerpt",
    ]),
  );
  for (const r of rows) {
    const row = ws.addRow([
      r.rooms,
      r.agent_code,
      r.agent_name,
      r.client_type,
      r.guest,
      r.check_in,
      r.check_out,
      r.nights,
      r.room_count,
      r.meal,
      r.rate_night,
      r.amount || null,
      r.received || null,
      r.outstanding || null,
      r.paid_unpaid,
      r.agent_phone,
      r.sheet_matched,
      r.rack_status,
      r.nationality,
      r.comment,
    ]);
    if (r.paid_unpaid === "Unpaid") {
      row.getCell(15).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFDE8E8" },
      };
    } else if (r.paid_unpaid === "Paid") {
      row.getCell(15).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F8EF" },
      };
    }
  }
  for (const c of [11, 12, 13, 14]) ws.getColumn(c).numFmt = "#,##0.00";
  ws.columns.forEach((col) => {
    let w = 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length + 2;
      if (len > w) w = Math.min(48, len);
    });
    col.width = w;
  });

  const sum = wb.addWorksheet("Summary");
  sum.addRow([`Pelbu Olakha stays ${FROM} → ${TODAY}`]);
  sum.addRow(["Stays", rows.length]);
  sum.addRow(["Paid", rows.filter((r) => r.paid_unpaid === "Paid").length]);
  sum.addRow(["Unpaid", rows.filter((r) => r.paid_unpaid === "Unpaid").length]);
  sum.addRow(["Unknown pay status", rows.filter((r) => r.paid_unpaid === "Unknown").length]);
  sum.addRow([
    "Sum amounts (Nu)",
    Math.round(rows.reduce((a, r) => a + (r.amount || 0), 0)),
  ]);
  sum.addRow([
    "Sum paid (Nu)",
    Math.round(rows.reduce((a, r) => a + (r.received || 0), 0)),
  ]);
  sum.addRow([
    "Sum due (Nu)",
    Math.round(rows.reduce((a, r) => a + (r.outstanding || 0), 0)),
  ]);
  sum.addRow([
    "With agent phone",
    rows.filter((r) => r.agent_phone).length,
  ]);

  await wb.xlsx.writeFile(OUT);
  console.log(
    JSON.stringify(
      {
        out: OUT,
        stays: rows.length,
        paid: rows.filter((r) => r.paid_unpaid === "Paid").length,
        unpaid: rows.filter((r) => r.paid_unpaid === "Unpaid").length,
        unknown: rows.filter((r) => r.paid_unpaid === "Unknown").length,
        with_phone: rows.filter((r) => r.agent_phone).length,
        with_amount: rows.filter((r) => r.amount > 0).length,
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
