import XLSX from "xlsx";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

let xlsx;
try {
  xlsx = XLSX;
} catch {
  xlsx = require("xlsx");
}

const path = process.argv[2] || "C:/Users/rajiv/Downloads/Reservation 2026 (8).xlsx";
const wb = xlsx.readFile(path, { cellDates: true });
console.log("sheets", wb.SheetNames);

for (const name of wb.SheetNames) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
  console.log("\n===", name, "rows", rows.length, "===");
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    console.log(i, JSON.stringify(rows[i]));
  }
}
