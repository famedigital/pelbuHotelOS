import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const file = process.argv[2] || "C:/Users/rajiv/Downloads/Reservation 2026 (8).xlsx";
const wb = XLSX.readFile(file, { cellDates: true, cellNF: false });

for (const name of ["October 2026", "November 2026", "September 2026"]) {
  const sheet = wb.Sheets[name];
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  console.log(`\n======== ${name} totalRows=${rows.length} ========`);
  // Find room grid end, then dump following non-empty rows that look like notes
  let headerIdx = -1;
  for (let i = 0; i < 20; i++) {
    if (String(rows[i]?.[0] || "").match(/date and room/i)) {
      headerIdx = i;
      break;
    }
  }
  let lastRoom = headerIdx;
  for (let i = headerIdx + 1; i < Math.min(rows.length, headerIdx + 80); i++) {
    const a = String(rows[i]?.[0] || "");
    if (/\d{3}$/.test(a.trim()) || /deluxe|suite|pelbu/i.test(a)) lastRoom = i;
    else if (a.trim() && lastRoom > headerIdx && i > lastRoom + 1) break;
  }
  console.log("header", headerIdx, "lastRoomApprox", lastRoom);
  // Print rows after rooms that have content
  let printed = 0;
  for (let i = lastRoom + 1; i < rows.length && printed < 60; i++) {
    const r = rows[i] || [];
    const cells = r
      .map((c, idx) => (c == null || String(c).trim() === "" ? null : `${idx}:${String(c).slice(0, 120)}`))
      .filter(Boolean);
    if (!cells.length) continue;
    console.log(i, cells.join(" | "));
    printed++;
  }
}
