/**
 * Build a detailed Excel for Pelbu Olakha (rooms sold / paid / receivable)
 * and optionally sync rack comment totals into Innora bookings.
 *
 * From web/:
 *   node --env-file=.env.local scripts/pelbu-olakha-money-workbook.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-money-workbook.mjs --apply
 */
import ExcelJS from "exceljs";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { parseRack } from "./lib/pelbu-olakha-rack.mjs";
import { restClient } from "./lib/supabase-rest.mjs";
import {
  readZip,
  rowsFromCells,
  sharedStrings,
  sheetCells,
  workbookSheets,
} from "./lib/xlsx-lite.mjs";
import { PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";

const APPLY = process.argv.includes("--apply");
const EXCEL_ONLY =
  process.argv.includes("--excel-only") || process.argv.includes("--sheet-only");
const TODAY = "2026-10-17";
const RACK_PATH = "C:/Users/rajiv/Downloads/Reservation 2026.xlsx";
const PAY_PATH = "C:/Users/rajiv/Downloads/Travel Agent Payment  (2).xlsx";
const OUT_XLSX = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : `C:/Users/rajiv/Downloads/Pelbu-Olakha-Agent-Money-${TODAY}.xlsx`;
const NOTE_TAG = "[olakha-rack-quote]";

function emptyErp() {
  return {
    property: { id: null, name: "Pelbu (sheet export)", slug: PROPERTY_SLUG },
    agents: [],
    agentsByKey: new Map(),
    linkByAgent: new Map(),
    bookings: [],
    agentById: new Map(),
  };
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
function nights(cin, cout) {
  if (!cin || !cout) return 0;
  const n = Math.max(0, (Date.parse(cout) - Date.parse(cin)) / 86400000);
  return Number.isFinite(n) ? n : 0;
}
function doorsOf(s) {
  return Math.max(
    1,
    String(s.room_labels || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean).length || (s.doors?.length ?? 1),
  );
}
function monthKey(iso) {
  return iso && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : "unknown";
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
function moneyCol(ws, cols) {
  for (const c of cols) ws.getColumn(c).numFmt = '#,##0.00';
}
function autoWidth(ws, min = 10, max = 42) {
  ws.columns.forEach((col) => {
    let w = min;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length + 2;
      if (len > w) w = Math.min(max, len);
    });
    col.width = w;
  });
}

async function loadErp(db) {
  const props = await db.select(
    `properties?select=id,name,slug&slug=eq.${PROPERTY_SLUG}`,
  );
  const property = props[0];
  if (!property) throw new Error(`Property ${PROPERTY_SLUG} not found`);

  const agents = await db.select(
    `agents?select=id,company_name,status,contact_name,contact_phone,contact_email,credit_limit,credit_used,market&order=company_name.asc&limit=2000`,
  );
  const links = await db.select(
    `agent_property_links?select=agent_id,credit_limit,credit_used,rate_tier,status&property_id=eq.${property.id}&limit=2000`,
  );
  const linkByAgent = new Map(links.map((l) => [l.agent_id, l]));

  const bookings = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const chunk = await db.select(
      `bookings?select=id,agent_id,contact_name,check_in,check_out,status,quoted_total_btn,rooms,notes,external_ref&property_id=eq.${property.id}&order=check_in.asc&limit=${pageSize}&offset=${offset}`,
    );
    bookings.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  const agentById = new Map(agents.map((a) => [a.id, a]));
  const agentsByKey = new Map();
  for (const a of agents) {
    const key = normAgent(a.company_name);
    const list = agentsByKey.get(key) ?? [];
    list.push(a);
    agentsByKey.set(key, list);
  }

  return { property, agents, agentById, agentsByKey, linkByAgent, bookings };
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
      month: month || monthKey(cin),
      agent,
      key: normAgent(agent),
      guest: String(r[1] ?? "").trim(),
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

function phoneForKey(key, agentsByKey, linkByAgent) {
  const list = agentsByKey.get(key) ?? [];
  for (const a of list) {
    if (a.contact_phone) {
      return {
        phone: a.contact_phone,
        email: a.contact_email || "",
        contact: a.contact_name || "",
        status: a.status,
        credit_used: Number(
          linkByAgent.get(a.id)?.credit_used ?? a.credit_used ?? 0,
        ),
        credit_limit: Number(
          linkByAgent.get(a.id)?.credit_limit ?? a.credit_limit ?? 0,
        ),
        agent_id: a.id,
      };
    }
  }
  if (list[0]) {
    const a = list[0];
    return {
      phone: a.contact_phone || "",
      email: a.contact_email || "",
      contact: a.contact_name || "",
      status: a.status,
      credit_used: Number(
        linkByAgent.get(a.id)?.credit_used ?? a.credit_used ?? 0,
      ),
      credit_limit: Number(
        linkByAgent.get(a.id)?.credit_limit ?? a.credit_limit ?? 0,
      ),
      agent_id: a.id,
    };
  }
  return {
    phone: "",
    email: "",
    contact: "",
    status: "",
    credit_used: 0,
    credit_limit: 0,
    agent_id: null,
  };
}

async function syncQuotesToInnora(db, propertyId, rackRows, bookings, agentById) {
  const byAgentDate = new Map();
  for (const b of bookings) {
    if (!b.agent_id) continue;
    const a = agentById.get(b.agent_id);
    const key = normAgent(a?.company_name || "");
    const k = `${key}|${b.check_in}|${b.check_out}`;
    const list = byAgentDate.get(k) ?? [];
    list.push(b);
    byAgentDate.set(k, list);
  }

  const updates = [];
  for (const r of rackRows) {
    if (!(r.quoted > 0.5)) continue;
    const k = `${r.key}|${r.cin}|${r.cout}`;
    const matches = byAgentDate.get(k) ?? [];
    for (const b of matches) {
      const current = Number(b.quoted_total_btn ?? 0);
      if (current > 0.5) continue;
      if (String(b.notes || "").includes(NOTE_TAG)) continue;
      updates.push({
        id: b.id,
        quoted_total_btn: r.quoted,
        agent: r.agent,
        cin: r.cin,
        guest: r.guest,
      });
    }
  }

  console.log(`Innora quote sync candidates: ${updates.length}`);
  if (!APPLY) {
    console.log("Dry-run only. Pass --apply to write quoted_total_btn.");
    return { planned: updates.length, applied: 0, samples: updates.slice(0, 8) };
  }

  let applied = 0;
  for (const u of updates) {
    const noteSuffix = `${NOTE_TAG} Nu ${u.quoted_total_btn} from rack comment ${TODAY}`;
    await db.update(`bookings?id=eq.${u.id}`, {
      quoted_total_btn: u.quoted_total_btn,
      notes: noteSuffix,
    });
    applied += 1;
  }
  console.log(`Applied ${applied} booking quote updates on ${propertyId}`);
  return { planned: updates.length, applied, samples: updates.slice(0, 8) };
}

async function main() {
  let db = null;
  let erp = emptyErp();
  if (!EXCEL_ONLY) {
    try {
      db = restClient();
      erp = await loadErp(db);
      console.log(`Property: ${erp.property.name} (${erp.property.slug})`);
    } catch (err) {
      console.warn(`ERP unavailable (${err.message}); exporting sheets only.`);
      erp = emptyErp();
      db = null;
    }
  } else {
    console.log("Excel-only mode — skipping Innora.");
  }

  const sheetStays = readPaymentSheet();
  const parsed = parseRack(resolve(RACK_PATH), TODAY);
  const rackActive = parsed.stays.filter((s) => !s.blocking);

  const rackRows = rackActive.map((s) => {
    const doors = doorsOf(s);
    const n = nights(s.check_in, s.check_out);
    const quoted =
      s.quoted_total_btn === "" || s.quoted_total_btn == null
        ? 0
        : Number(s.quoted_total_btn) || 0;
    const agent = s.agent_name || s.agent_code || "Unknown";
    return {
      agent,
      key: normAgent(agent),
      guest: s.guest_name || "",
      cin: s.check_in,
      cout: s.check_out,
      status: s.status,
      doors,
      nights: n,
      rn: n * doors,
      quoted,
      meal: s.meal_plan_code || "",
      rooms: s.room_labels || "",
      month: monthKey(s.check_in),
      comment: String(s.raw_comment || "").slice(0, 500),
    };
  });

  const sync =
    db && erp.property.id
      ? await syncQuotesToInnora(
          db,
          erp.property.id,
          rackRows,
          erp.bookings,
          erp.agentById,
        )
      : { planned: 0, applied: 0, samples: [] };

  // --- aggregates ---
  const sheetByAgent = new Map();
  for (const s of sheetStays) {
    const cur = sheetByAgent.get(s.key) || {
      agent: s.agent,
      key: s.key,
      billed: 0,
      received: 0,
      outstanding: 0,
      stays: 0,
      unpaid: 0,
      paid: 0,
    };
    cur.billed += s.total;
    cur.received += s.received;
    cur.outstanding += s.outstanding;
    cur.stays += 1;
    if (s.outstanding > 0.5) cur.unpaid += 1;
    if (s.received > 0.5 && s.outstanding <= 0.5) cur.paid += 1;
    sheetByAgent.set(s.key, cur);
  }

  const rackByAgent = new Map();
  for (const r of rackRows) {
    const cur = rackByAgent.get(r.key) || {
      agent: r.agent,
      stays: 0,
      rooms: 0,
      rn: 0,
      quoted: 0,
      priced: 0,
    };
    cur.stays += 1;
    cur.rooms += r.doors;
    cur.rn += r.rn;
    cur.quoted += r.quoted;
    if (r.quoted > 0) cur.priced += 1;
    rackByAgent.set(r.key, cur);
  }

  const keys = new Set([...sheetByAgent.keys(), ...rackByAgent.keys()]);
  const agentRows = [...keys]
    .map((key) => {
      const sh = sheetByAgent.get(key);
      const rk = rackByAgent.get(key);
      const ph = phoneForKey(key, erp.agentsByKey, erp.linkByAgent);
      return {
        agent: sh?.agent || rk?.agent || key,
        phone: ph.phone,
        email: ph.email,
        contact: ph.contact,
        erp_status: ph.status,
        credit_limit: ph.credit_limit,
        credit_used: ph.credit_used,
        rack_stays: rk?.stays ?? 0,
        rooms: Math.round(rk?.rooms ?? 0),
        rn: Math.round((rk?.rn ?? 0) * 10) / 10,
        rack_quoted: Math.round(rk?.quoted ?? 0),
        priced_stays: rk?.priced ?? 0,
        sheet_billed: Math.round(sh?.billed ?? 0),
        sheet_received: Math.round(sh?.received ?? 0),
        sheet_outstanding: Math.round(sh?.outstanding ?? 0),
        sheet_stays: sh?.stays ?? 0,
        unpaid_stays: sh?.unpaid ?? 0,
        paid_stays: sh?.paid ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.sheet_outstanding - a.sheet_outstanding || b.rn - a.rn,
    );

  const MONTH_LABELS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  function emptyMonth(ym) {
    return {
      month: ym,
      label: MONTH_LABELS[Number(ym.slice(5, 7)) - 1] || ym,
      stays_cin: 0,
      rooms: 0,
      rn: 0,
      quoted_cin: 0,
      quoted_by_night: 0,
      billed: 0,
      received: 0,
      outstanding: 0,
      sheet_stays: 0,
    };
  }
  function sheetMonthKey(s) {
    let key = monthKey(s.cin);
    if (key !== "unknown") return key;
    const m = String(s.month || "").toLowerCase();
    if (m.includes("jan")) return "2026-01";
    if (m.includes("feb")) return "2026-02";
    if (m.includes("mar")) return "2026-03";
    if (m.includes("apr")) return "2026-04";
    if (m.includes("may")) return "2026-05";
    if (m.includes("jun")) return "2026-06";
    if (m.includes("jul")) return "2026-07";
    if (m.includes("aug")) return "2026-08";
    if (m.includes("sep")) return "2026-09";
    if (m.includes("oct")) return "2026-10";
    if (m.includes("nov")) return "2026-11";
    if (m.includes("dec")) return "2026-12";
    return "unknown";
  }

  // Full calendar year through Dec
  const byMonth = new Map();
  for (let mo = 1; mo <= 12; mo++) {
    const ym = `2026-${String(mo).padStart(2, "0")}`;
    byMonth.set(ym, emptyMonth(ym));
  }

  for (const r of rackRows) {
    const cinKey = r.month;
    if (!byMonth.has(cinKey)) byMonth.set(cinKey, emptyMonth(cinKey));
    const host = byMonth.get(cinKey);
    host.stays_cin += 1;
    host.rooms += r.doors;
    host.quoted_cin += r.quoted;

    // Spread RN + comment totals across nights actually occupied
    const nightList = [];
    if (r.cin && r.nights > 0) {
      const [yy, mm, dd] = r.cin.split("-").map(Number);
      for (let i = 0; i < r.nights; i++) {
        const dt = new Date(Date.UTC(yy, mm - 1, dd + i));
        nightList.push(dt.toISOString().slice(0, 10));
      }
    }
    const totalRn = Math.max(r.rn || nightList.length * r.doors, 1);
    const perRn = r.quoted > 0 ? r.quoted / totalRn : 0;
    if (nightList.length) {
      for (const date of nightList) {
        const ym = monthKey(date);
        if (!byMonth.has(ym)) byMonth.set(ym, emptyMonth(ym));
        const cur = byMonth.get(ym);
        cur.rn += r.doors;
        cur.quoted_by_night += perRn * r.doors;
      }
    } else {
      host.rn += r.rn;
      host.quoted_by_night += r.quoted;
    }
  }

  for (const s of sheetStays) {
    const key = sheetMonthKey(s);
    if (!byMonth.has(key)) byMonth.set(key, emptyMonth(key));
    const cur = byMonth.get(key);
    cur.billed += s.total;
    cur.received += s.received;
    cur.outstanding += s.outstanding;
    cur.sheet_stays += 1;
  }

  const monthRows = [...byMonth.values()]
    .filter((m) => /^2026-\d{2}$/.test(m.month))
    .map((m) => {
      const cash = Math.round(m.received || 0);
      const expected = Math.round(m.quoted_by_night || 0);
      // Income: use payment-sheet cash when that month is on the sheet; else night-spread comment total
      const income = m.sheet_stays > 0 ? cash : expected;
      return {
        month: m.month,
        label: m.label,
        rack_stays: m.stays_cin || 0,
        rooms: Math.round(m.rooms || 0),
        rn: Math.round((m.rn || 0) * 10) / 10,
        rack_quoted: Math.round(m.quoted_cin || 0),
        expected_income: expected,
        billed: Math.round(m.billed || 0),
        received: cash,
        outstanding: Math.round(m.outstanding || 0),
        sheet_stays: m.sheet_stays || 0,
        income,
        income_source:
          m.sheet_stays > 0
            ? "Payment sheet (cash received)"
            : expected > 0
              ? "Rack comment rates (night-spread)"
              : "No rates yet",
      };
    })
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));

  // --- Excel ---
  const wb = new ExcelJS.Workbook();
  wb.creator = "Innora · Pelbu Olakha";
  wb.created = new Date();

  const incomeTotal = Math.round(monthRows.reduce((s, m) => s + m.income, 0));
  const expectedTotal = Math.round(
    monthRows.reduce((s, m) => s + m.expected_income, 0),
  );

  const monthIncome = wb.addWorksheet("Month income", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  monthIncome.addRow(["Pelbu Suites Olakha — Month-wise income 2026 (Jan–Dec)"]);
  monthIncome.getRow(1).font = {
    bold: true,
    size: 14,
    color: { argb: "FF1F4E3D" },
  };
  monthIncome.mergeCells("A1:L1");
  monthIncome.addRow([
    "Income = payment-sheet cash when that month is billed; otherwise night-spread rack comment totals. RN counted on each night occupied.",
  ]);
  monthIncome.mergeCells("A2:L2");
  monthIncome.addRow([]);
  styleHeader(
    monthIncome.addRow([
      "Month",
      "Label",
      "Stays (check-in)",
      "Rooms sold",
      "Room-nights",
      "Expected (comment rates, Nu)",
      "Sheet billed (Nu)",
      "Cash received (Nu)",
      "Still due (Nu)",
      "Income (Nu)",
      "Income source",
      "Sheet stays",
    ]),
  );
  for (const m of monthRows) {
    const row = monthIncome.addRow([
      m.month,
      m.label,
      m.rack_stays,
      m.rooms,
      m.rn,
      m.expected_income,
      m.billed,
      m.received,
      m.outstanding,
      m.income,
      m.income_source,
      m.sheet_stays,
    ]);
    if (m.income > 0) {
      row.getCell(10).font = { bold: true };
    }
  }
  const tot = monthIncome.addRow([
    "",
    "TOTAL Jan–Dec",
    monthRows.reduce((s, m) => s + m.rack_stays, 0),
    monthRows.reduce((s, m) => s + m.rooms, 0),
    Math.round(monthRows.reduce((s, m) => s + m.rn, 0) * 10) / 10,
    expectedTotal,
    Math.round(monthRows.reduce((s, m) => s + m.billed, 0)),
    Math.round(monthRows.reduce((s, m) => s + m.received, 0)),
    Math.round(monthRows.reduce((s, m) => s + m.outstanding, 0)),
    incomeTotal,
    "",
    monthRows.reduce((s, m) => s + m.sheet_stays, 0),
  ]);
  tot.font = { bold: true };
  moneyCol(monthIncome, [6, 7, 8, 9, 10]);
  autoWidth(monthIncome);

  const summary = wb.addWorksheet("Summary", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  summary.addRow(["Pelbu Suites Olakha — Agent money report"]);
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: "FF1F4E3D" } };
  summary.addRow([`As of ${TODAY}`]);
  summary.addRow([`Sources: Reservation 2026.xlsx + Travel Agent Payment (2).xlsx`]);
  summary.addRow([]);
  summary.addRow(["Metric", "Value"]);
  styleHeader(summary.getRow(5));
  const sumPairs = [
    ["Month income total Jan–Dec (Nu)", incomeTotal],
    ["Expected from comment rates Jan–Dec (Nu)", expectedTotal],
    ["Rack stays", rackRows.length],
    ["Room units sold", rackRows.reduce((s, r) => s + r.doors, 0)],
    ["Room-nights sold", Math.round(rackRows.reduce((s, r) => s + r.rn, 0))],
    ["Stays with rate in comment", rackRows.filter((r) => r.quoted > 0).length],
    [
      "Sum of comment / rack totals (Nu)",
      Math.round(rackRows.reduce((s, r) => s + r.quoted, 0)),
    ],
    ["Sheet billed (Nu)", Math.round(sheetStays.reduce((s, x) => s + x.total, 0))],
    [
      "Sheet received / paid (Nu)",
      Math.round(sheetStays.reduce((s, x) => s + x.received, 0)),
    ],
    [
      "Pending receivable AR (Nu)",
      Math.round(sheetStays.reduce((s, x) => s + x.outstanding, 0)),
    ],
    ["Unpaid sheet bookings", sheetStays.filter((x) => x.outstanding > 0.5).length],
    ["Agents still owing", agentRows.filter((a) => a.sheet_outstanding > 0.5).length],
    ["Agents fully paid on sheet", agentRows.filter((a) => a.sheet_billed > 0.5 && a.sheet_outstanding <= 0.5).length],
    [
      "Innora quote sync",
      APPLY
        ? `${sync.applied} bookings updated`
        : `${sync.planned} candidates (dry-run — re-run with --apply)`,
    ],
  ];
  for (const [k, v] of sumPairs) summary.addRow([k, v]);
  autoWidth(summary);

  const byAgentWs = wb.addWorksheet("By Agent", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const agentHeaders = [
    "Agent",
    "Phone",
    "Contact",
    "Email",
    "ERP status",
    "Credit limit",
    "Credit used",
    "Rack stays",
    "Rooms",
    "RN",
    "Rack quoted (comment)",
    "Priced stays",
    "Sheet billed",
    "Sheet paid",
    "Pending receivable",
    "Sheet stays",
    "Unpaid stays",
    "Paid stays",
  ];
  styleHeader(byAgentWs.addRow(agentHeaders));
  for (const a of agentRows) {
    byAgentWs.addRow([
      a.agent,
      a.phone,
      a.contact,
      a.email,
      a.erp_status,
      a.credit_limit,
      a.credit_used,
      a.rack_stays,
      a.rooms,
      a.rn,
      a.rack_quoted,
      a.priced_stays,
      a.sheet_billed,
      a.sheet_received,
      a.sheet_outstanding,
      a.sheet_stays,
      a.unpaid_stays,
      a.paid_stays,
    ]);
  }
  moneyCol(byAgentWs, [6, 7, 11, 13, 14, 15]);
  // highlight owing rows
  byAgentWs.eachRow((row, i) => {
    if (i === 1) return;
    const due = Number(row.getCell(15).value || 0);
    if (due > 0.5) {
      row.getCell(15).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFDE8E8" },
      };
    }
  });
  autoWidth(byAgentWs);

  const monthWs = wb.addWorksheet("By Month", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(
    monthWs.addRow([
      "Month",
      "Label",
      "Rack stays",
      "Rooms",
      "RN",
      "Quoted at check-in",
      "Expected (night-spread)",
      "Sheet stays",
      "Billed",
      "Paid",
      "Receivable",
      "Income",
    ]),
  );
  for (const m of monthRows) {
    monthWs.addRow([
      m.month,
      m.label,
      m.rack_stays,
      m.rooms,
      m.rn,
      m.rack_quoted,
      m.expected_income,
      m.sheet_stays,
      m.billed,
      m.received,
      m.outstanding,
      m.income,
    ]);
  }
  moneyCol(monthWs, [6, 7, 9, 10, 11, 12]);
  autoWidth(monthWs);

  const unpaidWs = wb.addWorksheet("Unpaid stays", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(
    unpaidWs.addRow([
      "Agent",
      "Phone",
      "Guest",
      "Month",
      "Check-in",
      "Check-out",
      "Nights",
      "Rooms",
      "Meal",
      "Billed",
      "Received",
      "Due",
      "Status",
      "Remarks",
    ]),
  );
  for (const s of sheetStays
    .filter((x) => x.outstanding > 0.5)
    .sort((a, b) => b.outstanding - a.outstanding)) {
    const ph = phoneForKey(s.key, erp.agentsByKey, erp.linkByAgent);
    unpaidWs.addRow([
      s.agent,
      ph.phone,
      s.guest,
      s.month,
      s.cin,
      s.cout,
      s.nights,
      s.rooms,
      s.meal,
      s.total,
      s.received,
      s.outstanding,
      s.status,
      s.remarks,
    ]);
  }
  moneyCol(unpaidWs, [10, 11, 12]);
  autoWidth(unpaidWs);

  const paidWs = wb.addWorksheet("Paid stays", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(
    paidWs.addRow([
      "Agent",
      "Phone",
      "Guest",
      "Month",
      "Check-in",
      "Check-out",
      "Rooms",
      "Billed",
      "Received",
      "Status",
    ]),
  );
  for (const s of sheetStays
    .filter((x) => x.received > 0.5 && x.outstanding <= 0.5)
    .sort((a, b) => String(a.cin).localeCompare(String(b.cin)))) {
    const ph = phoneForKey(s.key, erp.agentsByKey, erp.linkByAgent);
    paidWs.addRow([
      s.agent,
      ph.phone,
      s.guest,
      s.month,
      s.cin,
      s.cout,
      s.rooms,
      s.total,
      s.received,
      s.status,
    ]);
  }
  moneyCol(paidWs, [8, 9]);
  autoWidth(paidWs);

  const sheetAll = wb.addWorksheet("Payment sheet all", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(
    sheetAll.addRow([
      "Agent",
      "Phone",
      "Guest",
      "Month",
      "In",
      "Out",
      "Nights",
      "Rooms",
      "Meal",
      "Billed",
      "Received",
      "Due",
      "Pay status",
      "Remarks",
    ]),
  );
  for (const s of sheetStays.sort((a, b) =>
    a.agent.localeCompare(b.agent) || String(a.cin).localeCompare(String(b.cin)),
  )) {
    const ph = phoneForKey(s.key, erp.agentsByKey, erp.linkByAgent);
    sheetAll.addRow([
      s.agent,
      ph.phone,
      s.guest,
      s.month,
      s.cin,
      s.cout,
      s.nights,
      s.rooms,
      s.meal,
      s.total,
      s.received,
      s.outstanding,
      s.status,
      s.remarks,
    ]);
  }
  moneyCol(sheetAll, [10, 11, 12]);
  autoWidth(sheetAll);

  const rackWs = wb.addWorksheet("Rack stays", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(
    rackWs.addRow([
      "Agent",
      "Phone",
      "Guest",
      "Month",
      "In",
      "Out",
      "Nights",
      "Rooms",
      "RN",
      "Status",
      "Meal",
      "Quoted from comment",
      "Room labels",
      "Comment (excerpt)",
    ]),
  );
  for (const r of [...rackRows].sort(
    (a, b) => a.agent.localeCompare(b.agent) || a.cin.localeCompare(b.cin),
  )) {
    const ph = phoneForKey(r.key, erp.agentsByKey, erp.linkByAgent);
    rackWs.addRow([
      r.agent,
      ph.phone,
      r.guest,
      r.month,
      r.cin,
      r.cout,
      r.nights,
      r.doors,
      r.rn,
      r.status,
      r.meal,
      r.quoted || null,
      r.rooms,
      r.comment,
    ]);
  }
  moneyCol(rackWs, [12]);
  autoWidth(rackWs);

  await wb.xlsx.writeFile(OUT_XLSX);
  console.log(`Excel written: ${OUT_XLSX}`);

  writeFileSync(
    resolve("scripts/_tmp-olakha-money-workbook-meta.json"),
    JSON.stringify(
      {
        out: OUT_XLSX,
        apply: APPLY,
        sync,
        summary: Object.fromEntries(sumPairs),
        month_income: monthRows.map((m) => ({
          month: m.month,
          label: m.label,
          rn: m.rn,
          income: m.income,
          source: m.income_source,
        })),
        agents: agentRows.length,
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
