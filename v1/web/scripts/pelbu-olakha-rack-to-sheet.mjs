/**
 * Build the Google Drive FO + import workbook from the 2026 reservation rack.
 *
 * Tabs:
 *   Reservation · In House · Departure  (FO lists as of today Thimphu)
 *   Rooms · Agents · Stays · RoomNights · Review  (import)
 *
 * Usage (from web/):
 *   node scripts/pelbu-olakha-rack-to-sheet.mjs
 *   node scripts/pelbu-olakha-rack-to-sheet.mjs --in="C:/Users/rajiv/Downloads/Reservation 2026 (2).xlsx"
 */

import { resolve } from "node:path";
import { roomSheetRows } from "./lib/pelbu-olakha-rooms.mjs";
import { parseRack, workbookRows } from "./lib/pelbu-olakha-rack.mjs";
import { writeWorkbook } from "./lib/xlsx-lite.mjs";

function argValue(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

const input = argValue("--in=") || "C:/Users/rajiv/Downloads/Reservation 2026.xlsx";
const output =
  argValue("--out=") || "C:/Users/rajiv/Downloads/Pelbu-Olakha-import-2026.xlsx";
const foOut =
  argValue("--fo-out=") ||
  "C:/Users/rajiv/Downloads/Pelbu-Suites-FO-Drive.xlsx";

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
const parsed = parseRack(resolve(input), today);
const tables = workbookRows(parsed, today);

writeWorkbook(resolve(output), [
  { name: "Reservation", rows: tables.reservation },
  { name: "In House", rows: tables.inHouse },
  { name: "Departure", rows: tables.departure },
  { name: "Rooms", rows: roomSheetRows() },
  { name: "Agents", rows: tables.agents },
  { name: "Stays", rows: tables.stays },
  { name: "RoomNights", rows: tables.nightRows },
  { name: "Review", rows: tables.review },
]);

writeWorkbook(resolve(foOut), [
  { name: "Reservation", rows: tables.reservation },
  { name: "In House", rows: tables.inHouse },
  { name: "Departure", rows: tables.departure },
]);

const blocking = parsed.stays.filter((stay) => stay.blocking).length;
const byStatus = {};
for (const stay of parsed.stays) {
  byStatus[stay.status] = (byStatus[stay.status] ?? 0) + 1;
}
console.log(
  JSON.stringify(
    {
      today,
      nights: parsed.nights.length,
      segments: parsed.segments.length,
      stays: parsed.stays.length,
      blocking,
      byStatus,
      foLists: tables.foCounts,
      review: parsed.review.length,
      agents: tables.agents.length - 1,
      output,
      foOut,
    },
    null,
    2,
  ),
);
