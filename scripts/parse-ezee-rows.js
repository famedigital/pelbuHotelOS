/**
 * Parse eZee Reservation List export into structured rows.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const XLSX =
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

function parseSheet(fp) {
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
  let sheetBuf = null;
  for (const [name, buf] of e) {
    if (name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml")) {
      sheetBuf = buf;
      break;
    }
  }
  if (!sheetBuf) throw new Error("No worksheet");
  const s = sheetBuf.toString("utf8");
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
    cells.set(`${row},${col}`, val);
    if (row > maxR) maxR = row;
    if (col > maxC) maxC = col;
  }
  const grid = [];
  for (let r = 0; r <= maxR; r++) {
    const row = [];
    for (let c = 0; c <= maxC; c++) row.push(String(cells.get(`${r},${c}`) || ""));
    grid.push(row);
  }
  return grid;
}

function parseDate(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
  if (!m) return null;
  const mon = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  }[m[2].toLowerCase()];
  if (mon == null) return null;
  let y = +m[3];
  if (y < 100) y += 2000;
  const d = String(+m[1]).padStart(2, "0");
  const mo = String(mon + 1).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function money(raw) {
  const n = parseFloat(String(raw || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Fixed column indices from eZee print header row */
const COL = {
  rsrv: 2,
  rsrvDate: 5,
  source: 10,
  guest: 16,
  arrival: 23,
  departure: 26,
  pax: 28,
  ac: 30,
  nights: 33,
  roomNo: 35,
  roomType: 37,
  rateType: 38,
  total: 40,
  paid: 42,
  user: 46,
};

function parseRows(grid) {
  let section = "unknown";
  const out = [];
  for (const r of grid) {
    const nonEmpty = r.map((c) => c.trim()).filter(Boolean);
    if (
      nonEmpty.length > 0 &&
      nonEmpty.length <= 4 &&
      nonEmpty.some((t) =>
        /Active Reservation|Cancelled|No Show|Checked|Departed|Waitlist|Tentative|Void/i.test(
          t,
        ),
      )
    ) {
      section =
        nonEmpty.find((t) =>
          /Reservation|Show|Checked|Departed|Waitlist|Tentative|Cancel|Void/i.test(
            t,
          ),
        ) || section;
      continue;
    }
    const rsrv = (r[COL.rsrv] || "").trim();
    if (!/^SSRESN\d+/i.test(rsrv)) continue;
    out.push({
      section,
      rsrv,
      rsrvDate: (r[COL.rsrvDate] || "").trim(),
      source: (r[COL.source] || "").trim().replace(/[-\s]+$/, "").trim(),
      guest: (r[COL.guest] || "").trim(),
      arrival: parseDate(r[COL.arrival]),
      departure: parseDate(r[COL.departure]),
      arrivalRaw: (r[COL.arrival] || "").trim(),
      departureRaw: (r[COL.departure] || "").trim(),
      pax: Math.max(1, parseInt(r[COL.pax], 10) || 1),
      children: 0,
      nights: Math.max(0, parseInt(r[COL.nights], 10) || 0),
      roomNo: (r[COL.roomNo] || "").trim(),
      roomType: (r[COL.roomType] || "").trim().replace(/\s+/g, " "),
      rateType: (r[COL.rateType] || "").trim(),
      total: money(r[COL.total]),
      paid: money(r[COL.paid]),
      user: (r[COL.user] || "").trim(),
    });
  }
  return out;
}

const grid = parseSheet(XLSX);
const rows = parseRows(grid);
const outPath = path.join(path.dirname(XLSX), "ezee-rows.json");
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));

const summary = {
  total: rows.length,
  sections: {},
  roomTypes: {},
  sources: {},
  missingDates: rows.filter((r) => !r.arrival || !r.departure).length,
  arrivalRange: null,
};
for (const r of rows) {
  summary.sections[r.section] = (summary.sections[r.section] || 0) + 1;
  summary.roomTypes[r.roomType] = (summary.roomTypes[r.roomType] || 0) + 1;
  summary.sources[r.source] = (summary.sources[r.source] || 0) + 1;
}
const arrives = rows.map((r) => r.arrival).filter(Boolean).sort();
if (arrives.length) summary.arrivalRange = [arrives[0], arrives[arrives.length - 1]];

console.log(JSON.stringify(summary, null, 2));
console.log("sample", rows[0]);
console.log("wrote", outPath);
