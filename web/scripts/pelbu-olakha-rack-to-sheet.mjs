/**
 * Build the Google Drive import workbook from the 2026 reservation rack.
 *
 * Usage (from web/):
 *   node scripts/pelbu-olakha-rack-to-sheet.mjs
 *   node scripts/pelbu-olakha-rack-to-sheet.mjs --in="C:/Users/rajiv/Downloads/Reservation 2026.xlsx"
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

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
const parsed = parseRack(resolve(input), today);
const tables = workbookRows(parsed);

writeWorkbook(resolve(output), [
  { name: "Rooms", rows: roomSheetRows() },
  { name: "Agents", rows: tables.agents },
  { name: "Stays", rows: tables.stays },
  { name: "RoomNights", rows: tables.nightRows },
  { name: "Review", rows: tables.review },
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
      review: parsed.review.length,
      agents: tables.agents.length - 1,
      output,
    },
    null,
    2,
  ),
);
