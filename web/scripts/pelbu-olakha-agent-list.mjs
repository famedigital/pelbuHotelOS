/**
 * Agent list from the daywise workbook, highest amount first.
 * Walk-in stays (no travel agent) follow the agents.
 * Phone and guide numbers come from the reservation comments.
 *
 * From web/:
 *   node scripts/pelbu-olakha-agent-list.mjs
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
  "C:/Users/rajiv/Downloads/Pelbu Olakha agent list 1 Aug to 25 Oct 2026.xlsx";

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
  return new Set(
    String(value || "")
      .split(/[^0-9]+/)
      .filter((part) => /^\d{3}$/.test(part)),
  );
}

function isWalkIn(agent) {
  const name = norm(agent);
  return !name || name === "walk in" || name === "wig" || name === "walkin";
}

function contacts(stay) {
  const text = String(stay?.raw_comment || "");
  const numbers = [
    ...text.matchAll(/(?:\+?975[\s-]*)?(\d{8})\b/g),
  ].map((match) => match[1]);
  const unique = [...new Set(numbers)];
  const guideLine =
    text.match(/guide(?:\s*name)?\s*[:：]\s*([^\n]+)/i)?.[1] || "";
  const guideNo =
    guideLine.match(/(\d{8})/)?.[1] ||
    text.match(/guide[^\n]{0,80}?(\d{8})/i)?.[1] ||
    stay?.guide_phone ||
    (unique.length === 1 ? unique[0] : "");
  const contactLine =
    text.match(
      /(?:contact|phone|mobile|tel)\s*(?:no\.?|number)?\s*[:：]\s*([^\n]+)/i,
    )?.[1] || "";
  const contactNo = contactLine.match(/(\d{8})/)?.[1] || "";
  const phone =
    contactNo && contactNo !== guideNo
      ? contactNo
      : unique.find((number) => number !== guideNo) || contactNo || guideNo || "";
  return { phone, guideNo };
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
  const rowRooms = roomsOf(row.roomNos);
  let overlap = 0;
  for (const door of stay.doors || []) if (rowRooms.has(String(door))) overlap += 1;
  if (overlap) score += overlap;
  return score;
}

const rack = parseRack(resolve(RACK), "2026-10-25");
const rackStays = rack.stays.filter((stay) => stay.status !== "cancelled" && !stay.blocking);

const wbIn = new ExcelJS.Workbook();
await wbIn.xlsx.readFile(resolve(DAYWISE));
const sheet = wbIn.getWorksheet("Stays");
const stays = [];
sheet.eachRow((row, number) => {
  if (number === 1) return;
  const agent = cellText(row.getCell(1).value);
  const checkIn = cellText(row.getCell(2).value).slice(0, 10);
  const checkOut = cellText(row.getCell(3).value).slice(0, 10);
  if (!checkIn) return;
  stays.push({
    agent,
    checkIn,
    checkOut,
    nights: cellNumber(row.getCell(4).value),
    rooms: cellNumber(row.getCell(5).value),
    amount: cellNumber(row.getCell(7).value),
    roomNos: cellText(row.getCell(9).value),
    guest: cellText(row.getCell(10).value),
    walkIn: isWalkIn(agent),
  });
});

const used = new Set();
for (const stay of stays) {
  let best = null;
  let bestScore = 0;
  rackStays.forEach((rackStay, index) => {
    if (used.has(index)) return;
    const score = scoreMatch(stay, rackStay);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  if (best == null || bestScore < 4) continue;
  used.add(best);
  const found = contacts(rackStays[best]);
  stay.phone = found.phone;
  stay.guideNo = found.guideNo;
  if (rackStays[best].source === "client") stay.walkIn = true;
}

function joinUnique(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].join(", ");
}

const agents = new Map();
const walkIns = [];
for (const stay of stays) {
  if (stay.walkIn) {
    walkIns.push(stay);
    continue;
  }
  const key = norm(stay.agent) || stay.agent;
  const group = agents.get(key) ?? { name: stay.agent, stays: [] };
  if (stay.agent.length > group.name.length) group.name = stay.agent;
  group.stays.push(stay);
  agents.set(key, group);
}

const agentRows = [...agents.values()]
  .map((group) => {
    group.stays.sort((a, b) => b.amount - a.amount || a.checkIn.localeCompare(b.checkIn));
    group.amount = Math.round(group.stays.reduce((sum, stay) => sum + stay.amount, 0) * 100) / 100;
    group.phone = joinUnique(group.stays, "phone");
    group.guideNo = joinUnique(group.stays, "guideNo");
    return group;
  })
  .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));

walkIns.sort((a, b) => b.amount - a.amount || a.checkIn.localeCompare(b.checkIn));

const out = new ExcelJS.Workbook();
out.creator = "Hotel OS";

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E3D" } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
}

const summary = out.addWorksheet("Agents", {
  views: [{ state: "frozen", ySplit: 1 }],
});
summary.addRow(["Agent", "Phone", "Guide no", "Stays", "Amount"]);
styleHeader(summary.getRow(1));
for (const group of agentRows) {
  summary.addRow([group.name, group.phone, group.guideNo, group.stays.length, group.amount]);
}
const walkTotal = Math.round(walkIns.reduce((sum, stay) => sum + stay.amount, 0) * 100) / 100;
const walkRow = summary.addRow([
  "Walk-in",
  joinUnique(walkIns, "phone"),
  joinUnique(walkIns, "guideNo"),
  walkIns.length,
  walkTotal,
]);
walkRow.font = { bold: true };
walkRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4D6" } };
summary.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + agentRows.length, column: 5 } };
summary.getColumn(1).width = 36;
summary.getColumn(2).width = 22;
summary.getColumn(3).width = 42;
summary.getColumn(4).width = 12;
summary.getColumn(5).width = 16;
summary.getColumn(5).numFmt = "#,##0.00";
summary.eachRow((row, number) => {
  if (number > 1) row.alignment = { vertical: "middle", wrapText: true };
});

const detail = out.addWorksheet("By agent", {
  views: [{ state: "frozen", ySplit: 1 }],
});
detail.addRow([
  "Agent",
  "Phone",
  "Guide no",
  "Guest",
  "Check-in",
  "Check-out",
  "Rooms",
  "Amount",
]);
styleHeader(detail.getRow(1));

function addStay(stay, shade) {
  const row = detail.addRow([
    stay.walkIn ? "Walk-in" : stay.agent,
    stay.phone || "",
    stay.guideNo || "",
    stay.guest || "",
    stay.checkIn,
    stay.checkOut,
    stay.rooms,
    stay.amount,
  ]);
  row.alignment = { vertical: "middle" };
  if (shade) {
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: shade } };
  }
}

for (const group of agentRows) {
  for (const stay of group.stays) addStay(stay);
  const total = detail.addRow([group.name, "", "", "", "", "Total", group.stays.reduce((n, s) => n + s.rooms, 0), group.amount]);
  total.font = { bold: true };
  total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F2EA" } };
}
const banner = detail.addRow(["Walk-in guests"]);
banner.font = { bold: true, color: { argb: "FF1F4E3D" } };
for (const stay of walkIns) addStay(stay, "FFFFF4D6");
if (walkIns.length) {
  const total = detail.addRow([
    "Walk-in",
    "",
    "",
    "",
    "",
    "Total",
    walkIns.reduce((n, stay) => n + stay.rooms, 0),
    walkTotal,
  ]);
  total.font = { bold: true };
  total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4D6" } };
}
detail.getColumn(1).width = 36;
detail.getColumn(2).width = 18;
detail.getColumn(3).width = 18;
detail.getColumn(4).width = 32;
detail.getColumn(5).width = 14;
detail.getColumn(6).width = 14;
detail.getColumn(7).width = 12;
detail.getColumn(8).width = 16;
detail.getColumn(8).numFmt = "#,##0.00";

await out.xlsx.writeFile(resolve(OUTPUT));

const withPhone = stays.filter((stay) => stay.phone || stay.guideNo).length;
console.log(
  JSON.stringify(
    {
      agents: agentRows.length,
      walkIns: walkIns.length,
      stays: stays.length,
      withPhoneOrGuide: withPhone,
      top: agentRows.slice(0, 8).map((group) => ({
        agent: group.name,
        amount: Math.round(group.amount),
        stays: group.stays.length,
      })),
      walkInAmount: Math.round(walkTotal),
      output: OUTPUT,
    },
    null,
    2,
  ),
);
