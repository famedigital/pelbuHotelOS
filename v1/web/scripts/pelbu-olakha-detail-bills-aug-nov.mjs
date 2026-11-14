/**
 * Detail bills Aug–Nov from reservation rack notes + agent rate card.
 * Sheets: Summary (agent-wise) · August · September · October · November
 *
 *   node scripts/pelbu-olakha-detail-bills-aug-nov.mjs
 *   node scripts/pelbu-olakha-detail-bills-aug-nov.mjs --in="C:/Users/rajiv/Downloads/Reservation 2026 (8).xlsx"
 */

import { resolve } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseComment, parseRack, parseSglDblRates } from "./lib/pelbu-olakha-rack.mjs";
import {
  readZip,
  rowsFromCells,
  sharedStrings,
  sheetCells,
  workbookSheets,
} from "./lib/xlsx-lite.mjs";

const FROM = "2026-08-01";
const TO = "2026-11-30";

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

const MONTH_SHEETS = [
  { key: "2026-08", name: "August", label: "August 2026" },
  { key: "2026-09", name: "September", label: "September 2026" },
  { key: "2026-10", name: "October", label: "October 2026" },
  { key: "2026-11", name: "November", label: "November 2026" },
];

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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

function num(v) {
  if (v === "" || v === "-" || v == null) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function excelSerialToIso(serial) {
  if (serial instanceof Date) return serial.toISOString().slice(0, 10);
  const n = Number(serial);
  if (!Number.isFinite(n)) {
    const s = String(serial || "").trim();
    const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const y = Number(m[3]);
      if (y && mo && d) {
        return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
  }
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
    .toISOString()
    .slice(0, 10);
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
  if (/manual bill|couldn.?t find|do not punch|no required of bill/i.test(n))
    return false;
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
  const saysSingle =
    /\b(single|sgl)\b/i.test(text) && !/\b(double|dbl|twin)\b/i.test(text);
  const saysDouble =
    /\b(double|dbl|twin)\b/i.test(text) && !/\bsingle\b/i.test(text);
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
      structured.items.reduce((sum, item) => sum + item.n * item.rate, 0) +
      extra;
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
  // Rack fills "Guest ST" when note has no guest — drop those placeholders
  if (/^guest\s+[A-Z0-9]{1,8}$/i.test(g)) return "";
  return g;
}

/**
 * Rack cell value is the group-booking alias (ST, JDMC, LB, YH…).
 * Confirmation / SOULTRIPS numbers inside the note are secondary codes.
 */
function bookingCodeOf(raw, agentCode) {
  const alias = String(agentCode || "").trim();
  const text = String(raw || "");
  const soul = text.match(
    /\b(?:SOUL\s*TRIPS?|SOULTRIPS?)\s*[:#]?\s*0?(\d{4,6})\b/i,
  );
  if (soul) {
    const conf = soul[0].replace(/\s+/g, " ").trim();
    return alias && !/^ST$/i.test(alias) ? `${alias} · ${conf}` : conf;
  }
  const conf = text.match(
    /\b(?:confirmation|conf(?:irmation)?\s*(?:no\.?|number)?|ref(?:erence)?|booking\s*(?:id|code|no\.?)?)\s*[:#]?\s*([A-Z0-9\/-]{4,24})\b/i,
  );
  if (conf) {
    return alias ? `${alias} · ${conf[1]}` : conf[1];
  }
  const slash = text.match(/\b([A-Z]{2,6}\/[A-Za-z0-9_-]{2,20})\b/);
  if (slash) return alias ? `${alias} · ${slash[1]}` : slash[1];
  return alias;
}

/** Column B: Alias first (rack cell), then agent name, then guest from the note. */
function guestAgentCodeLabel(row) {
  const alias = String(row.code || "").trim();
  const agent = row.agent || "Unknown";
  const guest = row.guest || "(see note)";
  const parts = [];
  if (alias) parts.push(alias);
  if (agent && normAgent(agent) !== normAgent(alias)) parts.push(agent);
  parts.push(guest);
  if (
    row.bookingCode &&
    alias &&
    row.bookingCode !== alias &&
    !String(row.bookingCode).startsWith(alias)
  ) {
    parts.push(row.bookingCode);
  }
  return parts.join(" / ");
}

function cleanNote(raw) {
  return String(raw || "")
    .replace(/\[Threaded comment\][\s\S]*?Comment:\s*/gi, "")
    .replace(/\t+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n+/g, " | ")
    .replace(/\s+/g, " ")
    .replace(/\|\s*\|/g, "|")
    .trim();
}

function normAgent(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/journery/g, "journey")
    .replace(/bhuan/g, "bhutan")
    .replace(/sliver/g, "silver")
    .replace(/travellers/g, "travelers")
    .replace(/soul\s*trips?/g, "soultrips")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function agentCanon(key) {
  let k = normAgent(key);
  if (!k) return "";
  if (/^journey\s*dmc|^journeydmc/.test(k)) return "journey dmc";
  if (/^little?\s*bhutan|^littl\s*bhutan|^lb$/.test(k)) return "little bhutan";
  if (/^yak\s*holidays?/.test(k)) return "yak holidays";
  if (/^soul\s*trips?|^soultrips|^st$/.test(k)) return "soultrips";
  if (/^travel\s*(and|&)?\s*living|^tl$/.test(k)) return "travel living";
  if (/^trekking[\s-]*in[\s-]*bhutan/.test(k)) return "trekking in bhutan";
  if (/^silver\s*pine/.test(k)) return "silver pine";
  if (/^dainty\s*tours/.test(k)) return "dainty tours travels";
  if (/^amazing\s*dragon/.test(k)) return "amazing dragon holidays";
  if (/^bhutan\s*riwong/.test(k)) return "bhutan riwong";
  if (/^southeast\s*himalaya|^sha$/.test(k)) return "southeast himalaya adventures";
  if (/^walk[\s-]*in|^wig$/.test(k)) return "walk in";
  return k;
}

function normGuest(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fmtDate(iso) {
  const [year, month, day] = String(iso || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

function payStatusFromNote(raw) {
  const note = String(raw || "");
  if (
    /payment\s*received|fully\s*paid|cash\s*(payment|given|safe)|amount\s*received|paid\s*in\s*full/i.test(
      note,
    )
  ) {
    return "Paid";
  }
  if (
    /not\s*received|to\s*be\s*paid|pending|unpaid|collect\s*on|on\s*arrival|on\s*check-?out|outstanding/i.test(
      note,
    )
  ) {
    return "Unpaid";
  }
  return "";
}

function readPaymentSheet(path) {
  if (!path || !existsSync(path)) return [];
  const payWb = readZip(readFileSync(path));
  const pStrings = sharedStrings(
    payWb.get("xl/sharedStrings.xml")?.toString("utf8") ?? "<sst></sst>",
  );
  const stays = [];
  for (const sheet of workbookSheets(payWb)) {
    const pRows = rowsFromCells(
      sheetCells(payWb.get(sheet.path).toString("utf8"), pStrings),
    );
    let month = null;
    let lastAgent = "";
    for (const r of pRows) {
      const c1 = String(r[1] ?? "");
      if (c1.includes("Month of")) {
        month = c1.replace("Month of", "").trim();
        continue;
      }
      const rawAgent = String(r[0] ?? "").trim();
      if (
        /travel agent|source|payment status/i.test(rawAgent) ||
        rawAgent.toLowerCase() === "travel agent payment follow-up"
      ) {
        continue;
      }
      // Local Payment sometimes leaves agent blank on continuation rows
      const agent = rawAgent || lastAgent;
      if (rawAgent) lastAgent = rawAgent;
      if (!agent) continue;
      const total = num(r[10]);
      const received = num(r[11]);
      const outstanding = num(r[12]);
      const status = String(r[13] ?? "").trim();
      if (!(total > 0 || received > 0 || outstanding > 0 || status)) continue;
      if (/^payment status$/i.test(status)) continue;
      stays.push({
        month,
        sheet: sheet.name || "",
        agent,
        key: agentCanon(agent),
        guest: String(r[1] ?? "").trim(),
        guestKey: normGuest(r[1]),
        cin: excelSerialToIso(r[4]),
        cout: excelSerialToIso(r[5]),
        total,
        received,
        outstanding,
        status,
        remarks: String(r[17] ?? r[16] ?? "")
          .replace(/\n/g, " ")
          .trim(),
        used: false,
      });
    }
  }
  return stays;
}

function matchSheet(row, sheetStays) {
  const key = agentCanon(row.agent);
  const g = normGuest(row.guest);
  let best = null;
  let bestScore = 0;
  for (const s of sheetStays) {
    if (s.used) continue;
    if (s.key !== key && !(key && s.key && (key.includes(s.key) || s.key.includes(key)))) {
      continue;
    }
    let score = 2;
    if (row.checkIn && s.cin && row.checkIn === s.cin) score += 5;
    else if (row.checkIn && s.cin) {
      const diff = Math.abs(Date.parse(row.checkIn) - Date.parse(s.cin)) / 86400000;
      if (diff <= 1) score += 3;
      else if (diff <= 2) score += 1;
      else continue;
    }
    if (g && s.guestKey) {
      if (g === s.guestKey) score += 4;
      else if (g.includes(s.guestKey) || s.guestKey.includes(g)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (!best || bestScore < 5) return null;
  best.used = true;
  return best;
}

function resolvePay(row, sheet) {
  if (sheet) {
    const received = sheet.received || 0;
    const outstanding =
      sheet.outstanding > 0.5
        ? sheet.outstanding
        : Math.max(0, (sheet.total || 0) - received);
    const status = String(sheet.status || "").toLowerCase().trim();
    const paidByStatus =
      status &&
      status !== "not received" &&
      /mbob|mpay|epay|cash|bank|upi|hdfc|cheque|received|paid|dk|transfer/.test(
        status,
      );
    const bits = [
      sheet.sheet ? `TA file · ${sheet.sheet}` : "TA file",
      sheet.status || "",
      received > 0 ? `recv ${btn(received)}` : "",
      outstanding > 0.5 ? `due ${btn(outstanding)}` : "",
      sheet.remarks || "",
    ].filter(Boolean);
    if (outstanding <= 0.5 && (received > 0.5 || paidByStatus)) {
      const paidAmt = received > 0.5 ? received : row.total;
      return {
        payLabel: "Paid",
        paid: Math.round(paidAmt * 100) / 100,
        unpaid: 0,
        payNote: bits.join(" · "),
      };
    }
    const unpaidAmt =
      outstanding > 0.5 ? outstanding : Math.max(0, row.total - received);
    return {
      payLabel: "Unpaid",
      paid: Math.round(received * 100) / 100,
      unpaid: Math.round(unpaidAmt * 100) / 100,
      payNote: bits.join(" · ") || "TA file · Not Received",
    };
  }

  const noteStatus = payStatusFromNote(row.rawNote);
  if (noteStatus === "Paid") {
    return {
      payLabel: "Paid",
      paid: row.total,
      unpaid: 0,
      payNote: "Paid (reservation note)",
    };
  }
  if (noteStatus === "Unpaid") {
    return {
      payLabel: "Unpaid",
      paid: 0,
      unpaid: row.total,
      payNote: "Unpaid (reservation note)",
    };
  }
  return {
    payLabel: "Unpaid",
    paid: 0,
    unpaid: row.total,
    payNote: "Not on TA Payment Follow-up — unpaid",
  };
}

function buildStayRows(parsed) {
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
        bookingCode: bookingCodeOf(stay.raw_comment, stay.agent_code),
        checkIn: stay.check_in || "",
        checkOut: stay.check_out || "",
        rooms: doors.length,
        roomNos: doors.join(", "),
        meal: priced.meal,
        rate: priced.rateText,
        amount: priced.amount,
        source: priced.source,
        status: stay.status || "",
        priceRemarks: priced.remarks,
        rawNote: cleanNote(stay.raw_comment),
        stayKey:
          stay.stay_key ||
          `${stay.agent_code}|${stay.check_in}|${doors[0]}|${stay.check_out}`,
      });
    }
  }

  const groups = new Map();
  for (const row of dayRows) {
    const key = row.stayKey;
    const g = groups.get(key) ?? {
      agent: row.agent,
      code: row.code,
      guest: row.guest,
      bookingCode: row.bookingCode,
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
      priceRemarks: new Set(),
      rawNote: row.rawNote,
      months: new Set(),
    };
    g.nights += 1;
    g.rooms = Math.max(g.rooms, row.rooms);
    for (const door of String(row.roomNos).split(",")) {
      if (door.trim()) g.roomNos.add(door.trim());
    }
    g.rates.add(row.rate);
    g.amount += row.amount;
    g.sources.add(row.source);
    if (row.priceRemarks) g.priceRemarks.add(row.priceRemarks);
    if (row.rawNote) g.rawNote = row.rawNote;
    if (row.date) g.months.add(row.date.slice(0, 7));
    groups.set(key, g);
  }

  return [...groups.values()]
    .map((g) => {
      const roomNos = [...g.roomNos]
        .sort((a, b) => Number(a) - Number(b))
        .join(", ");
      const rate =
        g.rates.size === 1 ? [...g.rates][0] : [...g.rates].join(" · ");
      const source = [...g.sources].join(" · ");
      const priceBits = [...g.priceRemarks].filter(Boolean);
      const remarksParts = [
        g.rawNote,
        roomNos ? `Rooms: ${roomNos}` : "",
        g.meal ? `Meal: ${g.meal}` : "",
        source ? `Rate from: ${source}` : "",
        ...priceBits,
      ].filter(Boolean);
      return {
        agent: g.agent,
        code: g.code,
        guest: g.guest,
        bookingCode: g.bookingCode,
        checkIn: g.checkIn,
        checkOut: g.checkOut,
        nights: g.nights,
        rooms: g.rooms,
        roomNos,
        rate,
        total: Math.round(g.amount * 100) / 100,
        meal: g.meal,
        source,
        status: g.status,
        rawNote: g.rawNote,
        remarks: remarksParts.join(" || "),
        months: [...g.months],
      };
    })
    .map((row) => ({
      ...row,
      guestAgentCode: guestAgentCodeLabel(row),
    }))
    .sort(
      (a, b) =>
        a.checkIn.localeCompare(b.checkIn) || a.agent.localeCompare(b.agent),
    );
}

const input =
  argValue("--in=") || "C:/Users/rajiv/Downloads/Reservation 2026 (8).xlsx";
const payPath =
  argValue("--pay=") ||
  [
    "C:/Users/rajiv/Downloads/TA Payment Follow up.xlsx",
    "C:/Users/rajiv/Downloads/Travel Agent Payment  (2).xlsx",
    "C:/Users/rajiv/Downloads/Travel Agent Payment .xlsx",
  ].find((p) => existsSync(p)) ||
  "";
const jsonOut =
  argValue("--json=") ||
  "C:/Users/rajiv/Downloads/_pelbu_detail_bills_aug_nov.json";

const parsed = parseRack(resolve(input), TO);
const stays = buildStayRows(parsed);
const sheetStays = readPaymentSheet(payPath);

const billed = stays.map((row) => {
  const sheet = matchSheet(row, sheetStays);
  const pay = resolvePay(row, sheet);
  const remarks = [
    pay.payNote,
    row.rawNote,
    row.roomNos ? `Rooms: ${row.roomNos}` : "",
    row.meal ? `Meal: ${row.meal}` : "",
  ]
    .filter(Boolean)
    .join(" || ");
  return {
    agent: row.agent,
    code: row.code,
    guest: row.guest,
    bookingCode: row.bookingCode,
    guestAgentCode: row.guestAgentCode,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    nights: row.nights,
    rooms: row.rooms,
    roomNos: row.roomNos,
    rate: row.rate,
    total: row.total,
    meal: row.meal,
    source: row.source,
    payLabel: pay.payLabel,
    paid: pay.paid,
    unpaid: pay.unpaid,
    payNote: pay.payNote,
    rawNote: row.rawNote,
    remarks,
    months: row.months,
  };
});

const byAgent = new Map();
for (const row of billed) {
  const key = agentCanon(row.agent) || normAgent(row.agent) || "unknown";
  const cur = byAgent.get(key) ?? {
    agent: row.agent,
    aliases: new Set(),
    bookings: 0,
    rooms: 0,
    nights: 0,
    total: 0,
    paid: 0,
    unpaid: 0,
  };
  cur.bookings += 1;
  cur.rooms += row.rooms;
  cur.nights += row.nights;
  cur.total += row.total;
  cur.paid += row.paid;
  cur.unpaid += row.unpaid;
  if (row.code) cur.aliases.add(row.code);
  if (row.agent && row.agent.length > cur.agent.length) cur.agent = row.agent;
  byAgent.set(key, cur);
}

const agentRows = [...byAgent.values()]
  .map((a) => ({
    ...a,
    aliases: [...a.aliases].sort().join(", "),
    total: Math.round(a.total * 100) / 100,
    paid: Math.round(a.paid * 100) / 100,
    unpaid: Math.round(a.unpaid * 100) / 100,
  }))
  .sort((a, b) => b.total - a.total || a.agent.localeCompare(b.agent));

const tot = agentRows.reduce(
  (s, a) => ({
    bookings: s.bookings + a.bookings,
    rooms: s.rooms + a.rooms,
    nights: s.nights + a.nights,
    total: s.total + a.total,
    paid: s.paid + a.paid,
    unpaid: s.unpaid + a.unpaid,
  }),
  { bookings: 0, rooms: 0, nights: 0, total: 0, paid: 0, unpaid: 0 },
);

const payload = {
  from: FROM,
  to: TO,
  input,
  payPath,
  billed,
  agentRows,
  tot: {
    bookings: tot.bookings,
    rooms: tot.rooms,
    nights: tot.nights,
    total: Math.round(tot.total * 100) / 100,
    paid: Math.round(tot.paid * 100) / 100,
    unpaid: Math.round(tot.unpaid * 100) / 100,
  },
  months: MONTH_SHEETS,
};

writeFileSync(resolve(jsonOut), JSON.stringify(payload), "utf8");
console.log(
  JSON.stringify(
    {
      json: jsonOut,
      stays: billed.length,
      agents: agentRows.length,
      total: Math.round(tot.total),
      paid: Math.round(tot.paid),
      unpaid: Math.round(tot.unpaid),
      sample: billed.slice(0, 3).map((r) => ({
        alias: r.code,
        guestAgentCode: r.guestAgentCode,
        checkIn: r.checkIn,
        rooms: r.rooms,
        total: r.total,
        notePreview: String(r.remarks || "").slice(0, 120),
      })),
    },
    null,
    2,
  ),
);
