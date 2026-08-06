/**
 * Peek eZee Reservation List xlsx (no deps).
 * Usage: node scripts/parse-ezee-xlsx.js [path]
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const fp =
  process.argv[2] ||
  path.join(
    __dirname,
    "..",
    "marketing",
    "old bookings",
    "Reservation List_20260804.xlsx",
  );

function readZip(filePath) {
  const buf = fs.readFileSync(filePath);
  const entries = new Map();
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) !== 0x04034b50) {
      const n = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), i + 1);
      if (n < 0) break;
      i = n;
      continue;
    }
    const method = buf.readUInt16LE(i + 8);
    const comp = buf.readUInt32LE(i + 18);
    const flags = buf.readUInt16LE(i + 6);
    const nl = buf.readUInt16LE(i + 26);
    const el = buf.readUInt16LE(i + 28);
    const name = buf.toString("utf8", i + 30, i + 30 + nl);
    const ds = i + 30 + nl + el;
    if (comp === 0 && flags & 8) {
      i = ds + 1;
      continue;
    }
    const data = buf.subarray(ds, ds + comp);
    try {
      const c =
        method === 0 ? data : method === 8 ? zlib.inflateRawSync(data) : null;
      if (c) entries.set(name, c);
    } catch {}
    i = ds + comp;
  }
  return entries;
}

function colL(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function decode(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function excelSerialToIso(n) {
  const num = +n;
  if (!Number.isFinite(num) || num < 20000 || num > 80000) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(num) * 86400000);
  return d.toISOString().slice(0, 10);
}

const e = readZip(fp);
let shared = [];
const ss = e.get("xl/sharedStrings.xml");
if (ss) {
  const s = ss.toString("utf8");
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(s))) {
    const parts = [];
    const tRe = /<t[^>]*>([^<]*)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(m[1]))) parts.push(decode(tm[1]));
    shared.push(parts.join(""));
  }
}

const wb = e.get("xl/workbook.xml").toString("utf8");
console.log("workbook sheets:", wb.match(/<sheet [^>]+>/g));

const sheets = [];
for (const [name, buf] of e) {
  if (!name.startsWith("xl/worksheets/sheet") || !name.endsWith(".xml"))
    continue;
  const s = buf.toString("utf8");
  const cells = new Map();
  let maxR = 0,
    maxC = 0;
  const cRe = /<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?/g;
  let m;
  while ((m = cRe.exec(s))) {
    const col = colL(m[1]);
    const row = +m[2] - 1;
    let val = m[4] != null ? m[4] : "";
    if (/t="s"/.test(m[3] || "") && val !== "") val = shared[+val] ?? val;
    cells.set(row + "," + col, val);
    if (row > maxR) maxR = row;
    if (col > maxC) maxC = col;
  }
  const grid = [];
  for (let r = 0; r <= maxR; r++) {
    const row = [];
    for (let c = 0; c <= maxC; c++) row.push(cells.get(r + "," + c) || "");
    if (row.some((x) => String(x).trim() !== "")) grid.push(row);
  }
  sheets.push({ name, grid });
  console.log("\n===", name, "dataRows", grid.length, "cols", maxC + 1, "===");
  for (let r = 0; r < Math.min(grid.length, 25); r++) {
    const pretty = grid[r].map((v) => {
      if (/^\d{5}(\.\d+)?$/.test(String(v))) {
        const iso = excelSerialToIso(v);
        return iso ? `${v}(${iso})` : v;
      }
      return v;
    });
    console.log(r + ":", pretty.join(" | "));
  }
}

const outJson = path.join(
  path.dirname(fp),
  "reservation-list-parsed.json",
);
fs.writeFileSync(outJson, JSON.stringify({ sheets }, null, 2));
console.log("\nWrote", outJson);
console.log("sheet sizes", sheets.map((s) => s.grid.length));
