/**
 * Daywise room-night sheet from the Olakha reservation rack.
 *
 * Comment rates win. When a comment has no rate, the Pelbu agent card
 * (incl. 10% S.C., no GST) is applied by meal plan and occupancy.
 * EP is not on the agent card, so those nights use the CP net and are flagged.
 *
 * From web/:
 *   node scripts/pelbu-olakha-daywise-sheet.mjs
 *   node scripts/pelbu-olakha-daywise-sheet.mjs --in="C:/Users/rajiv/Downloads/Reservation 2026 (5).xlsx"
 */

import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { parseComment, parseRack, parseSglDblRates } from "./lib/pelbu-olakha-rack.mjs";

const FROM = "2026-08-01";
const TO = "2026-10-25";

const CARD = {
  deluxe: {
    CP: { sgl: 3200, dbl: 3450 },
    MAP: { sgl: 4200, dbl: 5600 },
  },
  suite: {
    CP: { sgl: 8400, dbl: 9300 },
    MAP: { sgl: 9100, dbl: 10600 },
  },
};

function argValue(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function money(raw) {
  const n = Number(String(raw ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function btn(n) {
  const value = Math.round((Number(n) || 0) * 100) / 100;
  if (Number.isInteger(value)) return value.toLocaleString("en-IN");
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function categoryOf(door) {
  return door === "502" ? "suite" : "deluxe";
}

function cleanCompany(name) {
  return String(name || "")
    .replace(/^agent\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/g, "")
    .trim();
}

function looksLikeCompany(name, code) {
  const n = cleanCompany(name);
  if (!n || n.length < 3) return false;
  if (n.toUpperCase() === String(code || "").toUpperCase()) return false;
  if (/^\d{3}([/,]\s*\d{3})*$/.test(n)) return false;
  if (/manual bill|couldn.?t find|do not punch|no required of bill/i.test(n)) return false;
  return true;
}

function mealOf(stay) {
  const raw = stay.raw_comment || "";
  const line = raw.match(
    /meals?\s*(?:plan)?\s*[:：.]?\s*(EPAI|MAPAI|CPAI|APAI|MAP|CP|EP|BB|AP)\b/i,
  );
  const token = (line?.[1] || "").toUpperCase();
  if (token.startsWith("MAP")) return { plan: "MAP", label: "MAP", note: "" };
  if (token === "CP" || token === "CPAI" || token === "BB")
    return { plan: "CP", label: "CP", note: "" };
  if (token.startsWith("EP"))
    return {
      plan: "CP",
      label: "EP",
      note: "EP is not on the agent card — CP net used",
    };
  if (token.startsWith("AP"))
    return {
      plan: "MAP",
      label: "AP",
      note: "AP is not on the agent card — MAP net used",
    };
  if (/breakfast\s+and\s+dinner|half[\s-]*board/i.test(raw))
    return { plan: "MAP", label: "MAP", note: "" };
  if (/with breakfast|\bbreakfast\b/i.test(raw))
    return { plan: "CP", label: "CP", note: "" };
  return {
    plan: "CP",
    label: "CP",
    note: "Meal plan not in the comment — CP net used",
  };
}

function explicitPax(raw) {
  const text = String(raw || "");
  const labelled = text.match(
    /(?:no\.?\s*of\s*pax|number\s*of\s*pax|pax)\s*[:：]\s*(\d+)/i,
  );
  if (labelled) return Number(labelled[1]);
  const adults = text.match(/\b(\d+)\s*adults?\b/i);
  if (adults) return Number(adults[1]);
  const pax = text.match(/\b(\d+)\s*pax\b/i);
  if (pax) return Number(pax[1]);
  return null;
}

function mixFromLine(line) {
  const mix = { sgl: 0, dbl: 0, twin: 0, tpl: 0, foc: 0 };
  let text = String(line || "");
  text = text.replace(
    /(\d+)\s*[xX×]?\s*(?:doubles?|dbls?|dbl|twins?|twn|rooms?)\s*FOC\b/gi,
    (_, n) => {
      mix.foc += Number(n);
      return " ";
    },
  );
  const re =
    /(\d+)\s*[xX×]?\s*(singles?|sgls?|sgl|doubles?|dbls?|dbl|twins?|twn|triples?|tpl|triple)\b/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    const w = m[2].toLowerCase();
    if (!Number.isFinite(n) || n <= 0 || n > 40) continue;
    if (w.startsWith("s")) mix.sgl += n;
    else if (w.startsWith("d")) mix.dbl += n;
    else if (w.startsWith("tw") || w === "twn") mix.twin += n;
    else mix.tpl += n;
  }
  return mix;
}

function mixSum(mix) {
  return mix.sgl + mix.dbl + mix.twin + mix.tpl + mix.foc;
}

function bestMix(raw, doorCount) {
  const candidates = [];
  for (const line of String(raw || "").split(/\n/)) {
    const mix = mixFromLine(line);
    if (mixSum(mix) > 0) candidates.push(mix);
  }
  const whole = mixFromLine(raw);
  if (mixSum(whole) > 0) candidates.push(whole);
  if (!candidates.length) return { sgl: 0, dbl: 0, twin: 0, tpl: 0, foc: 0 };
  const ranked = [...candidates].sort((a, b) => {
    const da = Math.abs(mixSum(a) - doorCount);
    const db = Math.abs(mixSum(b) - doorCount);
    return da - db || mixSum(b) - mixSum(a);
  });
  return ranked[0];
}

function extractRates(raw) {
  const text = String(raw || "");
  const found = {
    sgl: null,
    dbl: null,
    flat: null,
    extra: 0,
    fromComment: false,
  };
  for (const m of text.matchAll(
    /([\d,]{3,7}(?:\.\d+)?)\s*\/?-?\s*per\s+(double|single|twin|suite|deluxe|room)\b/gi,
  )) {
    const n = money(m[1]);
    if (n == null || n < 1500 || n > 25000) continue;
    const kind = m[2].toLowerCase();
    if (kind.startsWith("s")) found.sgl = n;
    else if (kind === "room") found.flat = n;
    else found.dbl = n;
    found.fromComment = true;
  }
  for (const m of text.matchAll(
    /\b(?:MAPAI|CPAI|EPAI|APAI|MAP|CP|EP|BB|AP)\s*\(\s*([\d,]{3,7}(?:\.\d+)?)(?:\s*[xX×]\s*\d+\s*=\s*[\d,]+(?:\.\d+)?)?/gi,
  )) {
    const n = money(m[1]);
    if (n != null && n >= 1500 && n <= 25000) {
      found.flat = found.flat ?? n;
      found.fromComment = true;
    }
  }
  for (const m of text.matchAll(
    /\b(?:MAPAI|CPAI|EPAI|APAI)\s+([\d,]{3,6}(?:\.\d+)?)\b/gi,
  )) {
    const n = money(m[1]);
    if (n != null && n >= 1500 && n <= 25000) {
      found.flat = found.flat ?? n;
      found.fromComment = true;
    }
  }
  const mix = parseSglDblRates(text);
  if (mix.sgl != null && mix.sgl >= 1500 && mix.sgl <= 25000) {
    found.sgl = found.sgl ?? mix.sgl;
    found.fromComment = true;
  }
  if (mix.dbl != null && mix.dbl >= 1500 && mix.dbl <= 25000) {
    found.dbl = found.dbl ?? mix.dbl;
    found.fromComment = true;
  }
  if (!found.fromComment) {
    const eq = text.match(
      /(?:Nu\.?\s*)([\d,]{3,6}(?:\.\d+)?)\s*[xX×]\s*(\d+)\s*(?:nights?|n|rooms?)?\s*=\s*([\d,]+)/i,
    );
    const mul = text.match(
      /Nu\.?\s*([\d,]{3,6}(?:\.\d+)?)\s*[xX×]\s*(\d+)\b/i,
    );
    const hit = eq || mul;
    if (hit) {
      const rate = money(hit[1]);
      const qty = Number(hit[2]);
      if (rate != null && rate >= 1500 && rate <= 25000 && qty > 0 && qty < 80) {
        found.flat = rate;
        found.fromComment = true;
      }
    }
  }
  const roomNu = text.match(
    /#?\d{3}\s*\(\s*Nu\.?\s*([\d,]{3,6})(?:\s*\+\s*([\d,]{2,5}))?/i,
  );
  if (roomNu && !found.fromComment) {
    const n = money(roomNu[1]);
    if (n != null && n >= 1500 && n <= 25000) {
      found.flat = n;
      found.extra = money(roomNu[2]) ?? 0;
      found.fromComment = true;
    }
  }
  return found;
}

function lumpQuote(raw, nights, rooms) {
  if (!raw || nights < 1 || rooms < 1) return null;
  const parsed = parseComment(raw, 2026);
  const total = parsed.quoted;
  if (total == null) return null;
  const per = total / (nights * rooms);
  if (per >= 1800 && per <= 20000) return { total, per: Math.round(per * 100) / 100 };
  if (nights * rooms === 1 && total >= 1800 && total <= 20000)
    return { total, per: total };
  return null;
}

/** "12Twin X 4740" lines, plus FOC rooms, when they add up to the doors. */
function structuredRates(raw, doorCount) {
  const items = [];
  for (const m of String(raw || "").matchAll(
    /(\d+)\s*(twins?|twn|singles?|sgls?|sgl|doubles?|dbls?|dbl)\s*[xX×]\s*([\d,]{3,7}(?:\.\d+)?)/gi,
  )) {
    const n = Number(m[1]);
    const rate = money(m[3]);
    if (!rate || n <= 0 || n > 40) continue;
    const kind = /sgl|single/i.test(m[2]) ? "sgl" : "dbl";
    items.push({ n, kind, rate });
  }
  if (!items.length) return null;
  const focM = String(raw || "").match(
    /(\d+)\s*(?:singles?|sgls?|sgl|doubles?|dbls?|dbl|twins?|rooms?)\s*under\s*FOC/i,
  );
  const foc = focM ? Number(focM[1]) : 0;
  const counted = items.reduce((sum, item) => sum + item.n, 0) + foc;
  if (counted !== doorCount) return null;
  const roomSum = items.reduce((sum, item) => sum + item.n * item.rate, 0);
  let extra = 0;
  const grand = String(raw || "").match(/grand\s*totals?\s*[=:]([^\n]+)/i);
  if (grand) {
    const nums = [...grand[1].matchAll(/([\d,]+(?:\.\d+)?)/g)]
      .map((m) => money(m[1]))
      .filter((n) => n != null);
    const total = nums.at(-1);
    if (total != null && total > roomSum) {
      extra = Math.round((total - roomSum) * 100) / 100;
    }
  }
  return { items, foc, extra };
}

function fullComplimentary(raw) {
  return /full\s*complimentary|\bcomplimentary\s*stay\b|\bhouse\s*use\b/i.test(
    String(raw || ""),
  );
}

/**
 * One occ token per door: foc | sgl | dbl.
 * Twin rooms take the double net unless the comment marks them single.
 */
function assignOcc(raw, doors) {
  const mix = bestMix(raw, doors.length);
  const matched = mixSum(mix) === doors.length;
  const occ = [];
  if (matched && mixSum(mix) > 0) {
    for (let i = 0; i < mix.foc; i++) occ.push("foc");
    for (let i = 0; i < mix.sgl; i++) occ.push("sgl");
    for (let i = 0; i < mix.dbl + mix.twin + mix.tpl; i++) occ.push("dbl");
    return { occ: occ.slice(0, doors.length), mix, matched: true };
  }
  const text = String(raw || "");
  const saysSingle = /\b(single|sgl)\b/i.test(text) && !/\b(double|dbl|twin)\b/i.test(text);
  const saysDouble = /\b(double|dbl|twin)\b/i.test(text) && !/\bsingle\b/i.test(text);
  const pax = explicitPax(text);
  let sgl = 0;
  let dbl = doors.length;
  if (saysSingle) {
    sgl = doors.length;
    dbl = 0;
  } else if (saysDouble) {
    sgl = 0;
    dbl = doors.length;
  } else if (pax != null && pax > 0) {
    const doubles = Math.max(0, Math.min(doors.length, pax - doors.length));
    dbl = pax >= doors.length ? doubles : 0;
    sgl = doors.length - dbl;
    if (pax <= doors.length) {
      sgl = doors.length;
      dbl = 0;
    }
    if (pax >= doors.length * 2) {
      dbl = doors.length;
      sgl = 0;
    }
  }
  const foc = Math.min(mix.foc, doors.length);
  const tokens = [];
  for (let i = 0; i < foc; i++) tokens.push("foc");
  const rest = doors.length - foc;
  const sglN = Math.min(sgl, rest);
  const dblN = rest - sglN;
  for (let i = 0; i < sglN; i++) tokens.push("sgl");
  for (let i = 0; i < dblN; i++) tokens.push("dbl");
  return { occ: tokens, mix, matched: false };
}

function priceNight(stay, doors) {
  const raw = stay.raw_comment || "";
  const meal = mealOf(stay);
  const remarks = [];
  if (fullComplimentary(raw)) {
    return {
      meal: meal.label,
      amount: 0,
      rateText: "Complimentary",
      source: "Complimentary",
      remarks: "",
    };
  }

  const structured = structuredRates(raw, doors.length);
  if (structured) {
    const nights = Math.max(stay.nights?.length || 1, 1);
    const extra = Math.round((structured.extra / nights) * 100) / 100;
    const lines = structured.items.map(
      (item) =>
        `${item.kind === "sgl" ? "single" : "double"} ${btn(item.rate)} × ${item.n}`,
    );
    if (structured.foc) lines.push(`FOC × ${structured.foc}`);
    if (extra) lines.push(`extra ${btn(extra)}`);
    const amount =
      structured.items.reduce((sum, item) => sum + item.n * item.rate, 0) + extra;
    return {
      meal: meal.label,
      amount: Math.round(amount * 100) / 100,
      rateText: lines.join(" · "),
      source: "Comment",
      remarks: remarks.join("; "),
    };
  }

  const extracted = extractRates(raw);
  const nights = stay.nights?.length || 1;
  const rooms = Math.max(doors.length, 1);
  if (!extracted.fromComment) {
    const lump = lumpQuote(raw, nights, stay.doors?.length || rooms);
    if (lump) {
      extracted.flat = lump.per;
      extracted.fromComment = true;
      extracted.lump = true;
      remarks.push(`Lump sum ${btn(lump.total)} spread over the rack nights`);
    }
  }

  const { occ, mix, matched } = assignOcc(raw, doors);
  if (mix.foc > 0) remarks.push(`${mix.foc} room FOC in the comment`);
  if (!matched && mixSum(mix) > 0 && mixSum(mix) !== doors.length) {
    remarks.push(
      `Comment lists ${mixSum(mix)} rooms, rack has ${doors.length} this night`,
    );
  }

  const lines = [];
  let amount = extracted.extra || 0;
  let usedCard = false;
  let usedComment = false;
  const groups = new Map();

  doors.forEach((door, i) => {
    const token = occ[i] || "dbl";
    const cat = categoryOf(door);
    let rate = 0;
    let from = "card";
    if (token === "foc") {
      rate = 0;
      from = "foc";
    } else if (token === "sgl" && extracted.sgl != null) {
      rate = extracted.sgl;
      from = "comment";
    } else if (token !== "sgl" && extracted.dbl != null) {
      rate = extracted.dbl;
      from = "comment";
    } else if (extracted.flat != null) {
      rate = extracted.flat;
      from = "comment";
    } else {
      rate = CARD[cat][meal.plan][token === "sgl" ? "sgl" : "dbl"];
      from = "card";
    }
    if (from === "card") usedCard = true;
    if (from === "comment") usedComment = true;
    amount += rate;
    const key = `${from}|${cat}|${token}|${rate}`;
    const g = groups.get(key) ?? { from, cat, token, rate, n: 0 };
    g.n += 1;
    groups.set(key, g);
  });

  for (const g of groups.values()) {
    if (g.from === "foc" || g.rate === 0) {
      lines.push(`FOC × ${g.n}`);
      continue;
    }
    const occLabel = g.token === "sgl" ? "single" : "double";
    if (g.from === "card") {
      const where = g.cat === "suite" ? "Suite " : "";
      lines.push(`${where}${meal.plan} ${occLabel} ${btn(g.rate)} × ${g.n}`);
    } else {
      lines.push(`${occLabel} ${btn(g.rate)} × ${g.n}`);
    }
  }
  if (extracted.extra) lines.push(`extra ${btn(extracted.extra)}`);
  if (usedCard && meal.note) remarks.push(meal.note);

  let source = "Agent card";
  if (usedComment && usedCard) source = "Comment + agent card";
  else if (usedComment) source = extracted.lump ? "Comment total" : "Comment";

  return {
    meal: meal.label,
    amount: Math.round(amount * 100) / 100,
    rateText: lines.join(" · "),
    source,
    remarks: remarks.filter(Boolean).join("; "),
  };
}

function doorsOn(stay, date) {
  const doors = [];
  if (stay.doorNights instanceof Map) {
    for (const [door, dates] of stay.doorNights) {
      if (dates?.has?.(date)) doors.push(door);
    }
  }
  if (!doors.length && stay.allNights?.has?.(date)) {
    return [...(stay.doors || [])];
  }
  return doors.sort((a, b) => Number(a) - Number(b));
}

function canonicalNames(stays) {
  const byCode = new Map();
  for (const stay of stays) {
    const code = stay.agent_code || "";
    const row = byCode.get(code) ?? new Map();
    const name = cleanCompany(stay.agent_name);
    if (looksLikeCompany(name, code)) {
      row.set(name, (row.get(name) ?? 0) + 1);
    }
    byCode.set(code, row);
  }
  const out = new Map();
  for (const [code, names] of byCode) {
    const ranked = [...names.entries()].sort(
      (a, b) => b[1] - a[1] || b[0].length - a[0].length,
    );
    if (code === "WIG") {
      out.set(code, "Walk-in");
      continue;
    }
    out.set(code, ranked[0]?.[0] || code);
  }
  return out;
}

function agentLabel(stay, names) {
  if (stay.agent_code === "WIG") return "Walk-in";
  const own = cleanCompany(stay.agent_name);
  if (looksLikeCompany(own, stay.agent_code)) return own;
  return names.get(stay.agent_code) || stay.agent_code || "";
}

function guestLabel(stay) {
  const g = String(stay.guest_name || "").trim();
  if (!g || /^guest\s+/i.test(g)) return "";
  return g;
}

function buildRows(parsed) {
  const stays = parsed.stays.filter(
    (stay) => stay.status !== "cancelled" && !stay.blocking,
  );
  const names = canonicalNames(stays);
  const dayRows = [];
  for (const stay of stays) {
    const dates = [...(stay.allNights || [])]
      .filter((date) => date >= FROM && date <= TO)
      .sort();
    if (!dates.length) continue;
    for (const date of dates) {
      const doors = doorsOn(stay, date);
      if (!doors.length) continue;
      const priced = priceNight(stay, doors);
      dayRows.push({
        date,
        agent: agentLabel(stay, names),
        code: stay.agent_code || "",
        guest: guestLabel(stay),
        checkIn: stay.check_in || "",
        checkOut: stay.check_out || "",
        rooms: doors.length,
        roomNos: doors.join(", "),
        meal: priced.meal,
        rate: priced.rateText,
        amount: priced.amount,
        source: priced.source,
        status: stay.status || "",
        remarks: priced.remarks,
        stayKey: stay.stay_key || `${stay.agent_code}|${stay.check_in}|${doors[0]}`,
      });
    }
  }
  dayRows.sort((a, b) =>
    a.date === b.date
      ? a.agent.localeCompare(b.agent) || a.checkIn.localeCompare(b.checkIn)
      : a.date.localeCompare(b.date),
  );
  return dayRows;
}

function stayRows(dayRows) {
  const groups = new Map();
  for (const row of dayRows) {
    const key = row.stayKey;
    const g = groups.get(key) ?? {
      agent: row.agent,
      code: row.code,
      guest: row.guest,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      nights: 0,
      rooms: row.rooms,
      roomNos: new Set(),
      meal: row.meal,
      rates: new Set(),
      amount: 0,
      sources: new Set(),
      status: row.status,
      remarks: new Set(),
    };
    g.nights += 1;
    g.rooms = Math.max(g.rooms, row.rooms);
    for (const door of row.roomNos.split(",")) {
      if (door.trim()) g.roomNos.add(door.trim());
    }
    g.rates.add(row.rate);
    g.amount += row.amount;
    g.sources.add(row.source);
    if (row.remarks) g.remarks.add(row.remarks);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      amount: Math.round(g.amount * 100) / 100,
      roomNos: [...g.roomNos].sort((a, b) => Number(a) - Number(b)).join(", "),
      rate: g.rates.size === 1 ? [...g.rates][0] : "See daywise",
      source: [...g.sources].join(" · "),
      remarks: [...g.remarks].join(" | "),
    }))
    .sort(
      (a, b) =>
        a.checkIn.localeCompare(b.checkIn) || a.agent.localeCompare(b.agent),
    );
}

function dailyRows(dayRows) {
  const byDate = new Map();
  let cursor = FROM;
  while (cursor <= TO) {
    byDate.set(cursor, { date: cursor, rooms: 0, stays: 0, amount: 0 });
    cursor = addDays(cursor, 1);
  }
  for (const row of dayRows) {
    const day = byDate.get(row.date);
    if (!day) continue;
    day.rooms += row.rooms;
    day.stays += 1;
    day.amount += row.amount;
  }
  return [...byDate.values()].map((day) => ({
    ...day,
    amount: Math.round(day.amount * 100) / 100,
  }));
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E3D" } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
}

function paintSource(cell, source) {
  const s = String(source || "");
  let argb = "FFFFFFFF";
  if (s === "Complimentary") argb = "FFE6E6E6";
  else if (s.startsWith("Agent card")) argb = "FFFFF4D6";
  else if (s.includes("agent card")) argb = "FFFFE8CC";
  else if (s.startsWith("Comment")) argb = "FFE7F2EA";
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function addSheet(wb, name, headers, records, moneyCols) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.addRow(headers);
  styleHeader(ws.getRow(1));
  for (const record of records) ws.addRow(record);
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(records.length + 1, 1), column: headers.length },
  };
  ws.eachRow((row, n) => {
    if (n === 1) return;
    row.alignment = { vertical: "middle" };
  });
  headers.forEach((header, i) => {
    let w = Math.min(42, Math.max(12, header.length + 2));
    ws.getColumn(i + 1).eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length + 2;
      if (len > w) w = Math.min(48, len);
    });
    ws.getColumn(i + 1).width = w;
  });
  for (const col of moneyCols) ws.getColumn(col).numFmt = "#,##0.00";
  return ws;
}

const input =
  argValue("--in=") || "C:/Users/rajiv/Downloads/Reservation 2026 (5).xlsx";
const output =
  argValue("--out=") ||
  "C:/Users/rajiv/Downloads/Pelbu Olakha daywise 1 Aug to 25 Oct 2026.xlsx";

const parsed = parseRack(resolve(input), TO);
const dayRows = buildRows(parsed);
const stays = stayRows(dayRows);
const days = dailyRows(dayRows);

const wb = new ExcelJS.Workbook();
wb.creator = "Hotel OS";
wb.created = new Date("2026-10-25T12:00:00Z");

const daySheet = addSheet(
  wb,
  "Daywise",
  [
    "Date",
    "Agent",
    "Check-in",
    "Check-out",
    "Rooms",
    "Rate",
    "Amount",
    "Meal",
    "Room nos",
    "Guest",
    "Rate from",
    "Status",
    "Remarks",
  ],
  dayRows.map((row) => [
    row.date,
    row.agent,
    row.checkIn,
    row.checkOut,
    row.rooms,
    row.rate,
    row.amount,
    row.meal,
    row.roomNos,
    row.guest,
    row.source,
    row.status,
    row.remarks,
  ]),
  [7],
);
daySheet.eachRow((row, n) => {
  if (n === 1) return;
  paintSource(row.getCell(11), row.getCell(11).value);
});

addSheet(
  wb,
  "Stays",
  [
    "Agent",
    "Check-in",
    "Check-out",
    "Nights",
    "Rooms",
    "Rate",
    "Amount",
    "Meal",
    "Room nos",
    "Guest",
    "Rate from",
    "Status",
    "Remarks",
  ],
  stays.map((row) => [
    row.agent,
    row.checkIn,
    row.checkOut,
    row.nights,
    row.rooms,
    row.rate,
    row.amount,
    row.meal,
    row.roomNos,
    row.guest,
    row.source,
    row.status,
    row.remarks,
  ]),
  [7],
);

const dailySheet = addSheet(
  wb,
  "Daily total",
  ["Date", "Rooms", "Stays", "Amount"],
  days.map((day) => [day.date, day.rooms, day.stays, day.amount]),
  [4],
);
const grand = days.reduce(
  (sum, day) => ({
    rooms: sum.rooms + day.rooms,
    stays: sum.stays + day.stays,
    amount: sum.amount + day.amount,
  }),
  { rooms: 0, stays: 0, amount: 0 },
);
const totalRow = dailySheet.addRow([
  "Total",
  grand.rooms,
  grand.stays,
  Math.round(grand.amount),
]);
totalRow.font = { bold: true };

const notes = wb.addWorksheet("Rate card");
notes.columns = [{ width: 78 }, { width: 22 }, { width: 16 }, { width: 16 }];
const noteLines = [
  ["Pelbu Suites Olakha", ""],
  ["Period", `${FROM} to ${TO} (room nights)`],
  ["Source file", input],
  ["", ""],
  ["How a night is priced", ""],
  ["1", "Rate written in the reservation comment"],
  ["2", "If the comment has no rate: agent card below, by meal plan"],
  ["", ""],
  ["Agent card", "Incl. 10% service charge. GST not charged."],
  ["Room", "Occupancy", "CP", "MAP"],
  ["Deluxe (26 rooms)", "Single", 3200, 4200],
  ["Deluxe (26 rooms)", "Double", 3450, 5600],
  ["Suite 502", "Single", 8400, 9100],
  ["Suite 502", "Double", 9300, 10600],
  ["", ""],
  ["Meal not written", "CP net"],
  ["EP written, no rate in the comment", "CP net. EP is not on the agent card. Flagged in Remarks."],
  ["Twin room", "Double net, unless the comment says single"],
  ["Complimentary", "Amount 0"],
  ["Cancelled", "Left out"],
  ["Yellow rows", "Filled from the agent card"],
  ["Green rows", "Taken from the comment"],
];
for (const line of noteLines) notes.addRow(line);
notes.getRow(1).font = { bold: true, size: 14 };
notes.getRow(10).font = { bold: true };
notes.getCell("C11").numFmt = "#,##0";
notes.getCell("D11").numFmt = "#,##0";
notes.getCell("C12").numFmt = "#,##0";
notes.getCell("D12").numFmt = "#,##0";
notes.getCell("C13").numFmt = "#,##0";
notes.getCell("D13").numFmt = "#,##0";
notes.getCell("C14").numFmt = "#,##0";
notes.getCell("D14").numFmt = "#,##0";

await wb.xlsx.writeFile(resolve(output));

const bySource = {};
for (const row of dayRows) {
  bySource[row.source] = (bySource[row.source] ?? 0) + 1;
}
console.log(
  JSON.stringify(
    {
      from: FROM,
      to: TO,
      dayRows: dayRows.length,
      stays: stays.length,
      roomNights: grand.rooms,
      amount: Math.round(grand.amount),
      bySource,
      output,
    },
    null,
    2,
  ),
);
