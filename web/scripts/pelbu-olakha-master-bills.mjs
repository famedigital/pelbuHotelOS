/**
 * One master bill per agent for the 1 Aug–25 Oct daywise collection.
 *
 * From web/:
 *   node scripts/pelbu-olakha-master-bills.mjs
 */

import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { parseRack } from "./lib/pelbu-olakha-rack.mjs";

const DAYWISE =
  process.argv.find((a) => a.startsWith("--in="))?.slice(5) ||
  "C:/Users/rajiv/Downloads/Pelbu Olakha daywise 1 Aug to 25 Oct 2026.xlsx";
const RACK =
  process.argv.find((a) => a.startsWith("--rack="))?.slice(7) ||
  "C:/Users/rajiv/Downloads/Reservation 2026 (5).xlsx";
const OUTPUT =
  process.argv.find((a) => a.startsWith("--out="))?.slice(6) ||
  "C:/Users/rajiv/Downloads/Pelbu Olakha master bills 1 Aug to 25 Oct 2026.xlsx";

const PERIOD = "1 Aug 2026 – 25 Oct 2026";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function cellText(value) {
  if (value == null) return "";
  if (typeof value === "object" && value.result != null) return cellText(value.result);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function cellNumber(value) {
  const n = Number(cellText(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function roomsOf(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[^0-9]+/)
        .filter((part) => /^\d{3}$/.test(part)),
    ),
  ];
}

function fmtDate(iso) {
  const [year, month, day] = String(iso || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function isWalkIn(agent) {
  const name = norm(agent);
  return !name || name === "walk in" || name === "wig" || name === "walkin";
}

function explicitPax(raw) {
  const text = String(raw || "");
  const labelled = text.match(
    /(?:no\.?\s*of\s*pax|number\s*of\s*pax|pax)\s*[:：]\s*(\d+)/i,
  );
  if (labelled) return Number(labelled[1]);
  const adults = text.match(/\b(\d+)\s*adults?\b/i);
  if (adults) return Number(adults[1]);
  const pax = text.match(/\b(\d+)\s*pax\b/i);
  return pax ? Number(pax[1]) : null;
}

function guideNoOf(stay) {
  const text = String(stay?.raw_comment || "");
  const guideLine = text.match(/guide(?:\s*name)?\s*[:：]\s*([^\n]+)/i)?.[1] || "";
  return (
    guideLine.match(/(\d{8})/)?.[1] ||
    text.match(/guide[^\n]{0,80}?(\d{8})/i)?.[1] ||
    stay?.guide_phone ||
    ""
  );
}

function categoryOf(roomNos) {
  const doors = roomsOf(roomNos);
  if (!doors.length) return "";
  const suite = doors.filter((door) => door === "502");
  const deluxe = doors.filter((door) => door !== "502");
  const parts = [];
  if (deluxe.length) parts.push(`Deluxe ${deluxe.join(", ")}`);
  if (suite.length) parts.push(`Suite ${suite.join(", ")}`);
  return parts.join("; ");
}

function describe(stay) {
  const parts = [];
  if (stay.guest) parts.push(stay.guest);
  if (stay.nationality) parts.push(stay.nationality);
  const category = categoryOf(stay.roomNos);
  if (category) parts.push(category);
  if (stay.meal) parts.push(stay.meal);
  if (stay.pax) parts.push(`${stay.pax} pax`);
  if (stay.guideNo) parts.push(`Guide ${stay.guideNo}`);
  return parts.join(", ");
}

function scoreMatch(row, stay) {
  if (row.checkIn !== stay.check_in || row.checkOut !== stay.check_out) return 0;
  let score = 2;
  const guest = norm(row.guest);
  const stayGuest = norm(stay.guest_name);
  if (guest && stayGuest && (guest === stayGuest || guest.includes(stayGuest) || stayGuest.includes(guest))) {
    score += 4;
  }
  const agent = norm(row.agent);
  const stayAgent = norm(stay.agent_name || stay.agent_code);
  if (agent && stayAgent && (agent === stayAgent || agent.includes(stayAgent) || stayAgent.includes(agent))) {
    score += 2;
  }
  const rowRooms = new Set(roomsOf(row.roomNos));
  let overlap = 0;
  for (const door of stay.doors || []) if (rowRooms.has(String(door))) overlap += 1;
  if (overlap) score += overlap;
  return score;
}

function sheetTitle(name, used) {
  let base = name.replace(/[\\/*?:\[\]]/g, " ").replace(/\s+/g, " ").trim() || "Bill";
  base = base.slice(0, 28);
  let title = base;
  let n = 2;
  while (used.has(title.toLowerCase())) {
    const suffix = ` ${n}`;
    title = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(title.toLowerCase());
  return title;
}

const rack = parseRack(resolve(RACK), "2026-10-25");
const rackStays = rack.stays.filter((stay) => stay.status !== "cancelled" && !stay.blocking);

const source = new ExcelJS.Workbook();
await source.xlsx.readFile(resolve(DAYWISE));
const staySheet = source.getWorksheet("Stays");
const lines = [];
staySheet.eachRow((row, number) => {
  if (number === 1) return;
  const checkIn = cellText(row.getCell(2).value).slice(0, 10);
  if (!checkIn) return;
  lines.push({
    agent: cellText(row.getCell(1).value),
    checkIn,
    checkOut: cellText(row.getCell(3).value).slice(0, 10),
    nights: cellNumber(row.getCell(4).value),
    rooms: cellNumber(row.getCell(5).value),
    rate: cellText(row.getCell(6).value),
    amount: cellNumber(row.getCell(7).value),
    meal: cellText(row.getCell(8).value),
    roomNos: cellText(row.getCell(9).value),
    guest: cellText(row.getCell(10).value),
    nationality: "",
    pax: null,
    guideNo: "",
    walkIn: isWalkIn(cellText(row.getCell(1).value)),
  });
});

const usedRack = new Set();
for (const line of lines) {
  let best = null;
  let bestScore = 0;
  rackStays.forEach((stay, index) => {
    if (usedRack.has(index)) return;
    const score = scoreMatch(line, stay);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  if (best == null || bestScore < 4) continue;
  usedRack.add(best);
  const stay = rackStays[best];
  line.nationality = String(stay.nationality || "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  line.pax = explicitPax(stay.raw_comment);
  line.guideNo = guideNoOf(stay);
  if (stay.source === "client") line.walkIn = true;
  line.description = describe(line);
}
for (const line of lines) {
  if (!line.description) line.description = describe(line);
}

const groups = new Map();
const walkIns = [];
for (const line of lines) {
  if (line.walkIn) {
    walkIns.push(line);
    continue;
  }
  const key = norm(line.agent) || line.agent;
  const group = groups.get(key) ?? { name: line.agent, lines: [] };
  if (line.agent.length > group.name.length) group.name = line.agent;
  group.lines.push(line);
  groups.set(key, group);
}

const bills = [...groups.values()]
  .map((group) => {
    group.lines.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || b.amount - a.amount);
    group.amount = round2(group.lines.reduce((sum, line) => sum + line.amount, 0));
    group.nights = group.lines.reduce((sum, line) => sum + line.nights, 0);
    group.rooms = group.lines.reduce((sum, line) => sum + line.rooms, 0);
    return group;
  })
  .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));

walkIns.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || b.amount - a.amount);
const walkBill = {
  name: "Walk-in",
  lines: walkIns,
  amount: round2(walkIns.reduce((sum, line) => sum + line.amount, 0)),
  nights: walkIns.reduce((sum, line) => sum + line.nights, 0),
  rooms: walkIns.reduce((sum, line) => sum + line.rooms, 0),
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

const wb = new ExcelJS.Workbook();
wb.creator = "Hotel OS";
const taken = new Set(["collection"]);

function paintHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E3D" } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
}

function addBill(group, title) {
  const ws = wb.addWorksheet(title, {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
    views: [{ state: "frozen", ySplit: 6 }],
  });
  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = "PELBU SUITES OLAKHA";
  ws.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF1F4E3D" } };
  ws.mergeCells("A2:G2");
  ws.getCell("A2").value = "Master bill";
  ws.getCell("A2").font = { bold: true, size: 13 };
  ws.mergeCells("A3:G3");
  ws.getCell("A3").value = group.name;
  ws.getCell("A3").font = { bold: true, size: 12 };
  ws.mergeCells("A4:G4");
  ws.getCell("A4").value = `Entire bookings  ·  ${PERIOD}  ·  Incl. 10% service charge  ·  GST not charged`;
  ws.getCell("A4").font = { size: 10, color: { argb: "FF555555" } };
  ws.addRow([]);
  const header = ws.addRow([
    "Sl. no",
    "Description",
    "Check-in",
    "Check-out",
    "Nights",
    "Rate",
    "Amount",
  ]);
  paintHeader(header);
  group.lines.forEach((line, index) => {
    const row = ws.addRow([
      index + 1,
      line.description,
      fmtDate(line.checkIn),
      fmtDate(line.checkOut),
      line.nights,
      line.rate,
      line.amount,
    ]);
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(2).alignment = { vertical: "top", wrapText: true };
  });
  const total = ws.addRow([
    "",
    `Total  ·  ${group.lines.length} booking${group.lines.length === 1 ? "" : "s"}  ·  ${group.rooms} room${group.rooms === 1 ? "" : "s"}`,
    "",
    "",
    group.nights,
    "",
    group.amount,
  ]);
  total.font = { bold: true };
  total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F2EA" } };
  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 62;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 36;
  ws.getColumn(7).width = 16;
  ws.getColumn(7).numFmt = "#,##0.00";
  ws.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 5 + group.lines.length, column: 7 },
  };
  return ws;
}

const collection = wb.addWorksheet("Collection", {
  views: [{ state: "frozen", ySplit: 4 }],
  pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
});
collection.mergeCells("A1:G1");
collection.getCell("A1").value = "PELBU SUITES OLAKHA";
collection.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF1F4E3D" } };
collection.mergeCells("A2:G2");
collection.getCell("A2").value = "Master bill collection  ·  agent wise";
collection.getCell("A2").font = { bold: true, size: 13 };
collection.mergeCells("A3:G3");
collection.getCell("A3").value = `${PERIOD}  ·  Incl. 10% service charge  ·  GST not charged`;
collection.getCell("A3").font = { size: 10, color: { argb: "FF555555" } };
const collectionHeader = collection.addRow([
  "Sl. no",
  "Agent",
  "Bookings",
  "Nights",
  "Rooms",
  "Amount",
  "Bill",
]);
paintHeader(collectionHeader);

const named = [];
for (const group of bills) {
  const title = sheetTitle(group.name, taken);
  named.push({ group, title });
}
if (walkBill.lines.length) {
  named.push({ group: walkBill, title: sheetTitle("Walk-in", taken) });
}

named.forEach((item, index) => {
  const row = collection.addRow([
    index + 1,
    item.group.name,
    item.group.lines.length,
    item.group.nights,
    item.group.rooms,
    item.group.amount,
    "Open bill",
  ]);
  row.getCell(7).value = {
    text: "Open bill",
    hyperlink: `#'${item.title.replace(/'/g, "''")}'!A1`,
  };
  row.getCell(7).font = { color: { argb: "FF1F4E3D" }, underline: true };
  if (item.group.name === "Walk-in") {
    row.font = { bold: true };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4D6" } };
    row.getCell(7).font = { bold: true, color: { argb: "FF1F4E3D" }, underline: true };
  }
});

const grand = {
  bookings: named.reduce((sum, item) => sum + item.group.lines.length, 0),
  nights: named.reduce((sum, item) => sum + item.group.nights, 0),
  rooms: named.reduce((sum, item) => sum + item.group.rooms, 0),
  amount: round2(named.reduce((sum, item) => sum + item.group.amount, 0)),
};
const grandRow = collection.addRow(["", "Total", grand.bookings, grand.nights, grand.rooms, grand.amount, ""]);
grandRow.font = { bold: true };
grandRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E3D" } };
grandRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
collection.getColumn(1).width = 10;
collection.getColumn(2).width = 40;
collection.getColumn(3).width = 14;
collection.getColumn(4).width = 12;
collection.getColumn(5).width = 12;
collection.getColumn(6).width = 16;
collection.getColumn(7).width = 14;
collection.getColumn(6).numFmt = "#,##0.00";

for (const item of named) addBill(item.group, item.title);

await wb.xlsx.writeFile(resolve(OUTPUT));
console.log(
  JSON.stringify(
    {
      agents: bills.length,
      walkIns: walkBill.lines.length,
      bookings: grand.bookings,
      amount: grand.amount,
      output: OUTPUT,
    },
    null,
    2,
  ),
);
