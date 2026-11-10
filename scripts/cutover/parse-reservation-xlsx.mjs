import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const file =
  process.argv[2] ||
  "C:/Users/rajiv/Downloads/Reservation 2026 (8).xlsx";
const wb = XLSX.readFile(file, { cellDates: true, cellNF: false, cellText: false });
console.log(JSON.stringify({ sheets: wb.SheetNames }, null, 2));

for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
    header: 1,
    defval: null,
    raw: true,
  });
  console.log(`\n=== ${name} rows=${rows.length} ===`);
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    console.log(i, JSON.stringify(rows[i]));
  }
}
