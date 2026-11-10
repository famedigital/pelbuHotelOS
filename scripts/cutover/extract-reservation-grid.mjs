/**
 * Parse Pelbu "Reservation 2026" month grids → rooms + stay segments.
 * Cell values are agent codes (non-uniform); keep raw code for later edit.
 */
import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const file =
  process.argv[2] ||
  "C:/Users/rajiv/Downloads/Reservation 2026 (8).xlsx";
const outPath =
  process.argv[3] ||
  new URL("./_reservation-grid-extract.json", import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/,
    "$1",
  );

const SKIP_CODES = new Set(["", ".", "-", "x", "X", "null", "undefined"]);
const MONTHS = {
  "August 2026": { y: 2026, m: 8, days: 31 },
  "September 2026": { y: 2026, m: 9, days: 30 },
  "October 2026": { y: 2026, m: 10, days: 31 },
  "November 2026": { y: 2026, m: 11, days: 30 },
  "December 2026": { y: 2026, m: 12, days: 31 },
};

function normCode(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = String(v).replace(/\s+/g, " ").trim();
  if (!s || SKIP_CODES.has(s)) return null;
  // ignore pure punctuation / placeholder dots
  if (/^[.·•]+$/.test(s)) return null;
  return s.toUpperCase();
}

function parseRoomLabel(raw) {
  const s = String(raw ?? "").trim();
  if (!s || /^date and room/i.test(s)) return null;
  // e.g. "Deluxe Twin 201", "Pelbu Suite 502"
  const m = s.match(/^(.*?)[\s-]+(\d{3})$/);
  if (!m) return null;
  return {
    label: m[2],
    roomTypeName: m[1].trim(),
    raw: s,
  };
}

function roomTypeCode(name) {
  const n = name.toLowerCase();
  if (n.includes("suite")) return "SUITE";
  if (n.includes("twin")) return "DTWIN";
  if (n.includes("queen")) return "DQUEEN";
  if (n.includes("king")) return "DKING";
  if (n.includes("single")) return "DSINGLE";
  return "DELUXE";
}

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(ymdStr, n) {
  const [Y, M, D] = ymdStr.split("-").map(Number);
  const dt = new Date(Date.UTC(Y, M - 1, D + n));
  return dt.toISOString().slice(0, 10);
}

const wb = XLSX.readFile(file, { cellDates: true });
const roomsMap = new Map(); // label -> {label, roomTypeName, roomTypeCode}
const segments = []; // {roomLabel, agentCode, checkIn, checkOut, month}
const agentCodes = new Map(); // code -> count

for (const [sheetName, meta] of Object.entries(MONTHS)) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  // Find header row with day numbers
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = rows[i] || [];
    if (
      typeof r[0] === "string" &&
      /date and room/i.test(r[0]) &&
      r[1] === 1
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    console.warn("No header in", sheetName);
    continue;
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const room = parseRoomLabel(r[0]);
    if (!room) {
      // stop at first non-room block (comments / rate tables often follow)
      if (
        typeof r[0] === "string" &&
        r[0].trim() &&
        !/^(hold|cancelled|confirmed)/i.test(r[0])
      ) {
        // keep scanning a bit in case of blank gaps; break after dense junk
        const nextLooksRoom = parseRoomLabel(r[0]);
        if (!nextLooksRoom && i > headerIdx + 40) break;
      }
      continue;
    }

    roomsMap.set(room.label, {
      label: room.label,
      roomTypeName: room.roomTypeName,
      roomTypeCode: roomTypeCode(room.roomTypeName),
      raw: room.raw,
    });

    // Build day→code for this month
    const dayCodes = [];
    for (let d = 1; d <= meta.days; d++) {
      dayCodes[d] = normCode(r[d]);
    }

    // Contiguous runs → segments (half-open checkout = last night + 1)
    let d = 1;
    while (d <= meta.days) {
      const code = dayCodes[d];
      if (!code) {
        d += 1;
        continue;
      }
      let end = d;
      while (end + 1 <= meta.days && dayCodes[end + 1] === code) end += 1;
      const checkIn = ymd(meta.y, meta.m, d);
      const checkOut = addDays(ymd(meta.y, meta.m, end), 1);
      segments.push({
        roomLabel: room.label,
        agentCode: code,
        checkIn,
        checkOut,
        nights: end - d + 1,
        sheet: sheetName,
      });
      agentCodes.set(code, (agentCodes.get(code) || 0) + 1);
      d = end + 1;
    }
  }
}

const rooms = [...roomsMap.values()].sort((a, b) =>
  a.label.localeCompare(b.label, undefined, { numeric: true }),
);

// Merge cross-month contiguous same room+agent abutting segments
segments.sort((a, b) =>
  a.roomLabel === b.roomLabel
    ? a.checkIn.localeCompare(b.checkIn) || a.agentCode.localeCompare(b.agentCode)
    : a.roomLabel.localeCompare(b.roomLabel, undefined, { numeric: true }),
);

const merged = [];
for (const seg of segments) {
  const prev = merged[merged.length - 1];
  if (
    prev &&
    prev.roomLabel === seg.roomLabel &&
    prev.agentCode === seg.agentCode &&
    prev.checkOut === seg.checkIn
  ) {
    prev.checkOut = seg.checkOut;
    prev.nights += seg.nights;
    prev.sheet = `${prev.sheet}+${seg.sheet}`;
  } else {
    merged.push({ ...seg });
  }
}

const today = new Date().toISOString().slice(0, 10);
const tillDate = merged.filter((s) => s.checkIn <= today || s.checkOut > "2026-01-01");
// User asked till date — include all history through today AND future holds still useful.
// Interpret as: everything in the workbook (all months), status by today.
for (const s of merged) {
  if (s.checkOut <= today) s.status = "checked_out";
  else if (s.checkIn <= today && s.checkOut > today) s.status = "checked_in";
  else s.status = "confirmed";
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: file,
  roomCount: rooms.length,
  rooms,
  agentCodes: [...agentCodes.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count),
  segmentCount: merged.length,
  segments: merged,
  tillDate: today,
};

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(
  JSON.stringify(
    {
      outPath,
      roomCount: rooms.length,
      rooms: rooms.map((r) => r.label),
      segmentCount: merged.length,
      agents: payload.agentCodes.length,
      statusCounts: merged.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {}),
    },
    null,
    2,
  ),
);
