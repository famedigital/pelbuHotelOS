/**
 * Build proper review Excel from rack-resync payload (agents, stays, months).
 * Run after build-pelbu-rack-resync.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const payloadPath = path.join(__dirname, "_pelbu-rack-resync-payload.json");
const outPath =
  process.argv[2] ||
  "C:/Users/rajiv/Downloads/Pelbu Suites — Reservation CLEAN Aug-Dec 2026.xlsx";

const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const bookings = payload.bookings || [];
const agents = payload.agents || [];

function money(n) {
  return Math.round(Number(n) || 0);
}

const agentRows = [...agents]
  .sort((a, b) => a.code.localeCompare(b.code))
  .map((a) => {
    const list = bookings.filter((b) => b.agentCode === a.code);
    return {
      Code: a.code,
      "Agent name": a.name,
      Bookings: list.length,
      "Room nights": list.reduce((s, b) => s + (b.nights?.length || 0), 0),
      "Quoted Nu": money(list.reduce((s, b) => s + (b.chargeTotal || 0), 0)),
      Checked_out: list.filter((b) => b.status === "checked_out").length,
      In_house: list.filter((b) => b.status === "checked_in").length,
      Confirmed: list.filter((b) => b.status === "confirmed").length,
      Held: list.filter((b) => b.status === "held").length,
    };
  });

const stayRows = bookings
  .slice()
  .sort((a, b) => String(a.checkIn).localeCompare(b.checkIn) || a.roomNumber.localeCompare(b.roomNumber))
  .map((b, i) => ({
    "#": i + 1,
    Status: b.status,
    "Agent code": b.agentCode,
    "Agent name": b.agentName || b.agentCode,
    Guest: b.guestName,
    Room: b.roomNumber,
    "Check-in": b.checkIn,
    "Check-out": b.checkOut,
    Nights: b.nights?.length || 0,
    Plan: b.mealPlan,
    "Amount Nu": money(b.chargeTotal),
    Nationality: b.nationality || "",
    Confirmation: b.confirmationNo,
  }));

const months = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
const monthRows = months.map((ym) => {
  const list = bookings.filter((b) => String(b.checkIn).startsWith(ym));
  return {
    Month: ym,
    Bookings: list.length,
    "Room nights": list.reduce((s, b) => s + (b.nights?.length || 0), 0),
    "Amount Nu": money(list.reduce((s, b) => s + (b.chargeTotal || 0), 0)),
    Checked_out: list.filter((b) => b.status === "checked_out").length,
    In_house: list.filter((b) => b.status === "checked_in").length,
    Upcoming: list.filter((b) => b.status === "confirmed").length,
    Held: list.filter((b) => b.status === "held").length,
  };
});

const inhouse = stayRows.filter((r) => r.Status === "checked_in");
const upcoming = stayRows.filter((r) => r.Status === "confirmed" || r.Status === "held");
const departed = stayRows.filter((r) => r.Status === "checked_out");

const ratesRows = [
  { Card: "SOULTRIPS MoU", Plan: "MAP", Occupancy: "Double/twin", "All-in Nu": 5600 },
  { Card: "SOULTRIPS MoU", Plan: "MAP", Occupancy: "Single", "All-in Nu": 4200 },
  { Card: "SOULTRIPS MoU", Plan: "CP", Occupancy: "Double/twin", "All-in Nu": 4200 },
  { Card: "SOULTRIPS MoU", Plan: "CP", Occupancy: "Single", "All-in Nu": 3600 },
  { Card: "Default agent (no quote)", Plan: "MAP", Occupancy: "Deluxe", "All-in Nu": 5600 },
  { Card: "Default agent (no quote)", Plan: "CP", Occupancy: "Deluxe", "All-in Nu": 3450 },
  { Card: "Default suite", Plan: "MAP", Occupancy: "Suite", "All-in Nu": 10600 },
];

const legend = [
  ["Pelbu Suites Olakha — CLEAN reservation import"],
  ["Source", "Reservation 2026 (8).xlsx"],
  ["As of", payload.today],
  ["From", payload.from],
  ["Bookings", bookings.length],
  ["Agents", agents.length],
  [],
  ["Status rules"],
  ["checked_out", "check-out date on or before today"],
  ["checked_in", "in-house tonight (check-in ≤ today < check-out)"],
  ["confirmed", "future arrival"],
  ["held", "HOLD on rack"],
  [],
  ["Amounts"],
  ["Prefer sheet comment quoted total (incl 10% S.C., no GST)"],
  ["Else rate card / SOULTRIPS MoU"],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(legend), "README");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ratesRows), "Rates");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthRows), "Month summary");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(agentRows), "Agents");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stayRows), "All stays");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inhouse), "In-house today");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(departed), "Checked out");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(upcoming), "Upcoming + hold");

XLSX.writeFile(wb, outPath);
console.log(
  JSON.stringify(
    {
      outPath,
      bookings: bookings.length,
      agents: agents.length,
      byStatus: payload.stats?.byStatus,
      months: monthRows,
    },
    null,
    2,
  ),
);
