/**
 * Turn the monthly room-rack workbook into stays.
 * Occupied cells are agent codes. Stay detail lives in threaded comments.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  colIndex,
  readZip,
  sharedStrings,
  sheetCells,
  styleFills,
  threadedComments,
  workbookSheets,
} from "./xlsx-lite.mjs";
import {
  canonicalRooms,
  doorFromLabel,
  isFooterLabel,
} from "./pelbu-olakha-rooms.mjs";

const MONTHS = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const SKIP_CODES = new Set(["", ".", "`", "-", "—"]);

function pad(n) {
  return String(n).padStart(2, "0");
}

function isoDate(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function cmpDate(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function normalizeSpace(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function commentKey(text) {
  return normalizeSpace(text).toLowerCase().replace(/\s+/g, " ");
}

function parseMonthSheet(name) {
  const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(name.trim());
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  return { year: Number(match[2]), month };
}

function parseLooseDate(raw, fallbackYear) {
  let text = String(raw ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /^[\s.\-–—]*$/.test(text)) return null;
  text = text.split(/[;|]/)[0].trim();

  let match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(text);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const day = a > 12 ? a : b > 12 ? a : a;
    const month = a > 12 ? b : b > 12 ? b : b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return isoDate(year, month, day);
  }

  match = /^(\d{1,2})[./-]([A-Za-z]+)[./\-\s]+(\d{2,4})$/.exec(text);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    if (!month) return null;
    return isoDate(year, month, Number(match[1]));
  }

  match = /^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/.exec(text);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    const year = match[3] ? Number(match[3]) : fallbackYear;
    if (!month || !year) return null;
    return isoDate(year, month, Number(match[1]));
  }

  match = /^([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/.exec(text);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    const year = match[3] ? Number(match[3]) : fallbackYear;
    if (!month || !year) return null;
    return isoDate(year, month, Number(match[2]));
  }
  return null;
}

function validIso(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
}

function commentDatePairs(raw, fallbackYear) {
  const pairs = [];
  let pendingIn = "";
  for (const line of String(raw).split("\n")) {
    const inn =
      /(?:re[\s-]*)?check[\s-]*in(?:\s*date)?\s*[:：]\s*(.+)/i.exec(line) ||
      /c\/\s*in\s*[:：]\s*(.+)/i.exec(line);
    const out =
      /(?:re[\s-]*)?check[\s-]*out(?:\s*date)?\s*[:：]\s*(.+)/i.exec(line) ||
      /c\/\s*out\s*[:：]\s*(.+)/i.exec(line);
    if (inn) {
      const parsed = parseLooseDate(inn[1], fallbackYear);
      pendingIn = validIso(parsed) ? parsed : "";
    }
    if (out && pendingIn) {
      const parsed = parseLooseDate(out[1], fallbackYear);
      if (validIso(parsed) && parsed > pendingIn) pairs.push([pendingIn, parsed]);
      pendingIn = "";
    }
  }
  return pairs;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return normalizeSpace(match[1]);
  }
  return "";
}

function parseMoney(raw) {
  const n = Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 50000000) return null;
  return Math.round(n * 100) / 100;
}

export function parseComment(text, fallbackYear) {
  const raw = normalizeSpace(text);
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let first = lines[0] ?? "";
  let statusHint = "";
  if (/^cancelled\b/i.test(first)) {
    statusHint = "cancelled";
    first = first.replace(/^cancelled\b[:\s-]*/i, "").trim();
    if (!first && lines[1]) first = lines[1];
  } else if (/^hold\b/i.test(first)) {
    statusHint = "held";
    first = first.replace(/^hold\b[:\s-]*/i, "").trim();
  }

  const datePairs = commentDatePairs(raw, fallbackYear);
  const commentCheckIn = datePairs[0]?.[0] ?? "";
  const commentCheckOut = datePairs[0]?.[1] ?? "";

  const guest = firstMatch(raw, [
    /guest\s*names?\s*[:：]\s*([^\n]+)/i,
    /group\s*names?\s*[:：]\s*([^\n]+)/i,
  ]);
  const guestLine =
    guest ||
    lines.find((line) => /^(mr|ms|mrs|miss)\.?\s+\S+/i.test(line)) ||
    "";

  const nationality = firstMatch(raw, [
    /nationality\s*[:：]\s*([^\n]+)/i,
    /\bnat(?:ionality)?\s*[:：]\s*([^\n]+)/i,
  ]);

  const paxRaw = firstMatch(raw, [
    /(?:no\.?\s*of\s*pax|number\s*of\s*pax|pax)\s*[:：]\s*(\d+)/i,
    /(\d+)\s*pax\b/i,
    /\b(\d{1,2})\s*pax\b/i,
  ]);
  const adults = paxRaw ? Number(paxRaw) : null;

  const mealWritten = (
    raw.match(/\b(EPAI|MAPAI|CPAI|MAP|CP|EP|BB|AP)\b/i)?.[1] ?? ""
  ).toUpperCase();
  let mealCode = "";
  let aiPackage = false;
  if (mealWritten === "EPAI") {
    mealCode = "EP";
    aiPackage = true;
  } else if (mealWritten === "MAPAI") {
    mealCode = "MAP";
    aiPackage = true;
  } else if (mealWritten === "CPAI") {
    mealCode = "BB";
    aiPackage = true;
  } else if (mealWritten === "CP") mealCode = "BB";
  else if (["EP", "BB", "MAP", "AP"].includes(mealWritten)) mealCode = mealWritten;

  const guideLine = firstMatch(raw, [
    /guide(?:\s*name)?\s*[:：]\s*([^\n]+)/i,
  ]);
  const phones = [
    ...raw.matchAll(/(?:\+?975[\s-]*)?(\d{8})\b/g),
  ].map((m) => m[1]);
  const guidePhone =
    (guideLine.match(/(\d{8})/)?.[1] ?? "") ||
    (phones.length === 1 ? phones[0] : "");
  const guideName = guideLine
    .replace(/\d{5,}/g, " ")
    .replace(/\+?975\b/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const diet = firstMatch(raw, [/diet(?:\s*rest(?:riction)?)?\s*[:：]\s*([^\n]+)/i]);
  const eta = firstMatch(raw, [/\bETA\s*[:：]\s*([^\n]+)/i]);

  let quoted = null;
  const grandLine = raw.match(/grand\s*total\s*[=:]([^\n]+)/i);
  if (grandLine) {
    const nums = [...grandLine[1].matchAll(/([\d,]+(?:\.\d+)?)/g)]
      .map((m) => parseMoney(m[1]))
      .filter((n) => n != null);
    quoted = nums.at(-1) ?? null;
  }
  if (quoted == null) {
    const trailing = [...raw.matchAll(/=\s*([\d,]+(?:\.\d+)?)\s*\/?\s*$/gm)];
    if (trailing.length === 1) quoted = parseMoney(trailing[0][1]);
  }
  const moneyMentions = [
    ...raw.matchAll(/(?:nu\.?|btn)\s*([\d,]+(?:\.\d+)?)|\b([\d,]{4,}(?:\.\d+)?)\b/gi),
  ];
  const rateUnparsed =
    quoted == null &&
    (moneyMentions.length > 0 ||
      /\b(mapai|epai|cpai|\d+\s*[x×]\s*\d+)/i.test(raw));

  const extraBeds = /extra\s*(mattress|bed)/i.test(raw) ? 1 : 0;
  const roomNumbers = [
    ...new Set(
      [...raw.matchAll(/\b(\d{3})\b/g)]
        .map((m) => m[1])
        .filter((n) => doorFromLabel(n)),
    ),
  ];

  const company = first.replace(/\s+/g, " ").trim();
  const source = sourceFromCompany(company, raw);

  return {
    raw,
    company,
    source,
    statusHint,
    guest: cleanGuest(guestLine),
    nationality: nationality.replace(/\s+/g, " ").trim(),
    adults: adults && adults > 0 && adults < 500 ? adults : null,
    mealWritten,
    mealCode,
    aiPackage,
    guideName: guideName.replace(/^[:.-]+/, "").trim(),
    guidePhone,
    phones,
    diet,
    eta,
    quoted,
    rateUnparsed,
    extraBeds,
    commentCheckIn,
    commentCheckOut,
    datePairs,
    roomNumbers,
  };
}

function cleanGuest(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*[x×]?\s*\d+\s*pax.*$/i, "")
    .trim();
}

function sourceFromCompany(company, raw) {
  const head = `${company}\n${raw}`.slice(0, 240);
  if (/walk[\s-]*in/i.test(head)) return "client";
  if (/\b(ceo|house use|owner)\b/i.test(company)) return "owner";
  return "agent";
}

function guestOrigin(nationality, raw) {
  const text = `${nationality} ${raw}`.toLowerCase();
  if (/bhutan/.test(text)) return "local";
  if (/\b(india|indian|nepal|bangladesh|regional)\b/.test(text)) return "regional";
  if (/\bofficial\b/.test(text)) return "official";
  return "international";
}

function operationalStatus(checkIn, checkOut, today, hint) {
  if (hint === "cancelled") return "cancelled";
  if (hint === "held") return "held";
  if (!checkIn || !checkOut) return "confirmed";
  if (checkOut <= today) return "checked_out";
  if (checkIn > today) return "confirmed";
  return "checked_in";
}

function rangesOverlapOrAdjacent(aNights, bNights) {
  if (!aNights.length || !bNights.length) return false;
  const a0 = aNights[0];
  const a1 = aNights[aNights.length - 1];
  const b0 = bNights[0];
  const b1 = bNights[bNights.length - 1];
  const start = a0 > b0 ? a0 : b0;
  const end = a1 < b1 ? a1 : b1;
  if (start <= end) return true;
  return addDays(a1, 1) === b0 || addDays(b1, 1) === a0;
}

function hash8(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i) {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a, b) {
    const pa = this.find(a);
    const pb = this.find(b);
    if (pa !== pb) this.parent[pb] = pa;
  }
}

function legendStatus(fill, legend) {
  if (!fill || fill.startsWith("theme:")) return "";
  if (legend.held && fill === legend.held) return "held";
  if (legend.cancelled && fill === legend.cancelled) return "cancelled";
  return "";
}

function loadRack(filePath) {
  const files = readZip(readFileSync(filePath));
  const strings = sharedStrings(
    files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "<sst></sst>",
  );
  const fills = styleFills(
    files.get("xl/styles.xml")?.toString("utf8") ?? "",
  );
  const sheets = workbookSheets(files);
  const relsXml = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const sheetRels = new Map();
  for (const sheet of sheets) {
    const relPath = sheet.path.replace(
      /worksheets\/(sheet\d+)\.xml$/,
      "worksheets/_rels/$1.xml.rels",
    );
    sheetRels.set(sheet.path, files.get(relPath)?.toString("utf8") ?? "");
  }
  return { files, strings, fills, sheets, relsXml, sheetRels };
}

function commentsForSheet(files, relsXml) {
  const byRef = new Map();
  if (!relsXml) return byRef;
  for (const match of relsXml.matchAll(/Target="([^"]+)"/g)) {
    let target = match[1].replace(/^\//, "");
    if (target.startsWith("../")) target = `xl/${target.slice(3)}`;
    else if (!target.startsWith("xl/")) target = `xl/${target}`;
    if (!/threadedComment/i.test(target)) continue;
    const xml = files.get(target)?.toString("utf8");
    if (!xml) continue;
    const parsed = threadedComments(xml);
    for (const [ref, notes] of parsed) {
      const prev = byRef.get(ref) ?? [];
      byRef.set(ref, prev.concat(notes));
    }
  }
  return byRef;
}

export function parseRack(filePath, today = "2026-10-13") {
  const { files, strings, fills, sheets } = loadRack(filePath);
  const knownDoors = new Set(canonicalRooms().map((r) => r.door));
  const nights = [];
  const review = [];
  const orphanNotes = [];

  for (const sheet of sheets) {
    const when = parseMonthSheet(sheet.name);
    if (!when) continue;
    const xml = files.get(sheet.path)?.toString("utf8") ?? "";
    const cells = sheetCells(xml, strings);
    const relPath = sheet.path.replace(
      /worksheets\/(sheet\d+)\.xml$/,
      "worksheets/_rels/$1.xml.rels",
    );
    const comments = commentsForSheet(files, files.get(relPath)?.toString("utf8") ?? "");

    const legend = { held: "", cancelled: "" };
    for (const [ref, cell] of cells) {
      const label = normalizeSpace(cell.value).toUpperCase();
      const fill = fills[Number(cell.style)] ?? "";
      if (label === "HOLD" && fill && !fill.startsWith("theme:")) legend.held = fill;
      if (label === "CANCELLED" && fill && !fill.startsWith("theme:")) {
        legend.cancelled = fill;
      }
    }

    const dayByCol = new Map();
    const roomByRow = new Map();
    for (const [ref, cell] of cells) {
      const parsed = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!parsed) continue;
      const col = colIndex(parsed[1]);
      const row = Number(parsed[2]);
      if (row === 5 && col > 1) {
        const day = Number(String(cell.value).replace(/\.0$/, ""));
        if (day >= 1 && day <= 31) dayByCol.set(col, day);
      }
      if (col === 1 && row >= 6) {
        const label = normalizeSpace(cell.value);
        if (!label) continue;
        if (isFooterLabel(label)) break;
        const door = doorFromLabel(label);
        if (!door || !knownDoors.has(door)) {
          review.push({
            stay_key: "",
            severity: "blocking",
            issue: "unknown door",
            detail: `${sheet.name} row ${row}: ${label}`,
          });
          continue;
        }
        roomByRow.set(row, { door, label });
      }
    }

    const usedCommentRefs = new Set();
    for (const [ref, cell] of cells) {
      const parsed = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!parsed) continue;
      const col = colIndex(parsed[1]);
      const row = Number(parsed[2]);
      const room = roomByRow.get(row);
      const day = dayByCol.get(col);
      if (!room || !day) continue;
      const code = normalizeSpace(cell.value);
      if (SKIP_CODES.has(code) || isFooterLabel(code)) continue;
      const date = isoDate(when.year, when.month, day);
      if (!validIso(date)) continue;
      const notes = comments.get(ref) ?? [];
      if (notes.length) usedCommentRefs.add(ref);
      const comment = notes.map((n) => n.text).join("\n\n");
      const fillStatus = legendStatus(fills[Number(cell.style)] ?? "", legend);
      let statusHint = fillStatus;
      if (/^cancelled\b/i.test(code)) statusHint = "cancelled";
      if (/^hold\b/i.test(code)) statusHint = "held";
      nights.push({
        door: room.door,
        label: room.label,
        date,
        code,
        comment,
        statusHint,
        sheet: sheet.name,
        ref,
      });
    }

    for (const [ref, notes] of comments) {
      if (usedCommentRefs.has(ref)) continue;
      for (const note of notes) {
        const text = note.text.trim();
        if (!text || (/threaded comment/i.test(text) && text.length < 80)) continue;
        orphanNotes.push({
          sheet: sheet.name,
          ref,
          text,
          year: when.year,
        });
      }
    }
  }

  nights.sort((a, b) =>
    a.door === b.door
      ? a.date === b.date
        ? a.code.localeCompare(b.code)
        : cmpDate(a.date, b.date)
      : a.door.localeCompare(b.door),
  );

  const byDoorDate = new Map();
  for (const night of nights) {
    const key = `${night.door}|${night.date}`;
    const list = byDoorDate.get(key) ?? [];
    list.push(night);
    byDoorDate.set(key, list);
  }
  const uniqueNights = [];
  for (const [key, list] of byDoorDate) {
    const codes = [...new Set(list.map((n) => n.code))];
    if (codes.length > 1) {
      review.push({
        stay_key: "",
        severity: "blocking",
        issue: "two codes on one door-night",
        detail: `${key}: ${codes.join(" / ")}`,
      });
    }
    const withComment = list.find((n) => n.comment) ?? list[0];
    uniqueNights.push(withComment);
  }
  uniqueNights.sort((a, b) =>
    a.door === b.door ? cmpDate(a.date, b.date) : a.door.localeCompare(b.door),
  );

  const segments = [];
  for (const night of uniqueNights) {
    const prev = segments[segments.length - 1];
    const contiguous =
      prev &&
      prev.door === night.door &&
      prev.code === night.code &&
      addDays(prev.nights[prev.nights.length - 1], 1) === night.date;
    if (contiguous) {
      prev.nights.push(night.date);
      if (night.comment) prev.comments.push(night.comment);
      if (night.statusHint) prev.hints.push(night.statusHint);
      prev.labels.add(night.label);
    } else {
      segments.push({
        door: night.door,
        code: night.code,
        nights: [night.date],
        comments: night.comment ? [night.comment] : [],
        hints: night.statusHint ? [night.statusHint] : [],
        labels: new Set([night.label]),
      });
    }
  }
  for (const seg of segments) {
    seg.comment = [...new Set(seg.comments.map(normalizeSpace).filter(Boolean))].join(
      "\n\n",
    );
    seg.key = commentKey(seg.comment);
  }

  const uf = new UnionFind(segments.length);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i];
      const b = segments[j];
      if (!a.key || a.key.length < 20 || a.key !== b.key) continue;
      if (a.code !== b.code) continue;
      if (rangesOverlapOrAdjacent(a.nights, b.nights)) uf.union(i, j);
    }
  }

  const groups = new Map();
  segments.forEach((seg, i) => {
    const root = seg.key && seg.key.length >= 20 ? uf.find(i) : `solo:${i}`;
    const list = groups.get(root) ?? [];
    list.push(seg);
    groups.set(root, list);
  });

  let stays = [...groups.values()].map((segs) => buildStay(segs, today));

  const commented = stays.filter((s) => s.raw_comment);
  for (const stay of stays) {
    if (stay.raw_comment) continue;
    const overlaps = commented.filter(
      (other) =>
        other.agent_code === stay.agent_code && overlapNight(other, stay),
    );
    if (overlaps.length === 1) {
      mergeInto(overlaps[0], stay);
      stay.consumed = true;
    } else if (overlaps.length > 1) {
      stay.warnings.push("several stays share this code and dates");
    }
  }
  stays = stays.filter((s) => !s.consumed);

  for (const note of orphanNotes) {
    const key = commentKey(note.text);
    if (key && stays.some((s) => commentKey(s.raw_comment).includes(key.slice(0, 80)))) {
      continue;
    }
    const parsed = parseComment(note.text, note.year);
    const doors = parsed.roomNumbers.filter((d) => knownDoors.has(d));
    const checkIn = parsed.commentCheckIn;
    let checkOut = parsed.commentCheckOut;
    if (checkIn && checkOut && checkOut <= checkIn) checkOut = addDays(checkIn, 1);
    if (checkIn && !checkOut) checkOut = addDays(checkIn, 1);
    const noteNights =
      checkIn && checkOut ? new Set(nightsBetween(checkIn, checkOut)) : new Set();
    const host = stays.find((stay) => {
      if (stay.consumed) return false;
      const company = commentKey(parsed.company);
      const stayName = commentKey(stay.agent_name || stay.agent_code);
      const named =
        company &&
        stayName &&
        (stayName === company ||
          stayName.includes(company) ||
          company.includes(stayName));
      if (!named) return false;
      if (!noteNights.size) return false;
      for (const date of stay.allNights) {
        if (noteNights.has(date)) return true;
      }
      return false;
    });
    if (host) {
      if (!host.raw_comment) {
        host.raw_comment = note.text;
        if (parsed.guest) host.guest_name = parsed.guest;
        if (parsed.guideName) host.guide_name = parsed.guideName;
        if (parsed.guidePhone) host.guide_phone = parsed.guidePhone;
        if (parsed.mealCode) host.meal_plan_code = parsed.mealCode;
        if (parsed.quoted != null) host.quoted_total_btn = parsed.quoted;
        if (parsed.nationality) host.nationality = parsed.nationality;
        host.warnings = host.warnings.filter((w) => w !== "missing comment");
      }
      continue;
    }
    const warnings = ["comment is not on a room cell"];
    let blocking = false;
    if (!checkIn || !checkOut) {
      warnings.push("orphan comment has no dates");
      blocking = true;
    }
    if (!doors.length) {
      warnings.push("orphan comment has no room number");
      blocking = true;
    }
    stays.push(
      finishStay({
        code: parsed.company || "NOTE",
        doors,
        nights: checkIn && checkOut ? nightsBetween(checkIn, checkOut) : [],
        checkIn,
        checkOut,
        comments: [note.text],
        hints: parsed.statusHint ? [parsed.statusHint] : [],
        labels: new Set(doors),
        warnings,
        blocking,
        today,
      }),
    );
  }

  const active = new Map();
  for (const stay of stays) {
    if (stay.status === "cancelled" || stay.blocking) continue;
    for (const door of stay.doors) {
      for (const date of stay.doorNights.get(door) ?? []) {
        const key = `${door}|${date}`;
        const prev = active.get(key);
        if (prev && prev !== stay.stay_key) {
          review.push({
            stay_key: stay.stay_key,
            severity: "blocking",
            issue: "overlapping stay",
            detail: `${key} also ${prev}`,
          });
          stay.blocking = true;
          stay.warnings.push(`overlaps ${prev} on ${key}`);
        } else {
          active.set(key, stay.stay_key);
        }
      }
    }
  }

  for (const stay of stays) {
    for (const warning of stay.warnings) {
      const blockingWarning = /hard date|no dates|no room|overlap|unknown door/.test(
        warning,
      );
      const severity = stay.blocking && blockingWarning ? "blocking" : "warning";
      if (warning === "pax not parsed") continue;
      review.push({
        stay_key: stay.stay_key,
        severity,
        issue: warning,
        detail: `${stay.agent_code} ${stay.check_in} ${stay.room_labels}`,
      });
    }
    for (const alias of stay.aliasLabels) {
      review.push({
        stay_key: stay.stay_key,
        severity: "warning",
        issue: "category alias",
        detail: alias,
      });
    }
  }

  const seenReview = new Set();
  const reviewRows = review.filter((row) => {
    const key = `${row.severity}|${row.issue}|${row.detail}|${row.stay_key}`;
    if (seenReview.has(key)) return false;
    seenReview.add(key);
    return true;
  });

  return { stays, nights: uniqueNights, review: reviewRows, segments };
}

function nightsBetween(checkIn, checkOut) {
  const out = [];
  let cursor = checkIn;
  while (cursor < checkOut) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

function overlapNight(a, b) {
  const bNights = new Set(b.nights ?? b.allNights ?? []);
  for (const date of a.allNights ?? a.nights ?? []) {
    if (bNights.has(date)) return true;
  }
  return false;
}

function mergeInto(target, extra) {
  for (const door of extra.doors) {
    if (!target.doors.includes(door)) target.doors.push(door);
    const nights = extra.doorNights.get(door) ?? extra.nights ?? [];
    const set = target.doorNights.get(door) ?? new Set();
    for (const date of nights) {
      set.add(date);
      target.allNights.add(date);
    }
    target.doorNights.set(door, set);
  }
  target.doors.sort();
  const sorted = [...target.allNights].sort();
  target.check_in = sorted[0] ?? target.check_in;
  target.check_out = sorted.length ? addDays(sorted[sorted.length - 1], 1) : target.check_out;
  target.room_labels = target.doors.join(", ");
  retargetKey(target);
}

function retargetKey(stay) {
  const rooms = [...stay.doors].sort().join("-");
  const basis = stay.raw_comment || stay.guest_name || stay.agent_code;
  stay.external_ref = `rack:2026:${slug(stay.agent_code)}:${stay.check_in}:${rooms}:${hash8(basis)}`;
  stay.stay_key = stay.external_ref;
}

function buildStay(segs, today) {
  const nights = [];
  const doorNights = new Map();
  const comments = [];
  const hints = [];
  const labels = new Set();
  const code = segs[0].code;
  for (const seg of segs) {
    const set = doorNights.get(seg.door) ?? new Set();
    for (const date of seg.nights) {
      set.add(date);
      nights.push(date);
    }
    doorNights.set(seg.door, set);
    comments.push(...seg.comments);
    hints.push(...seg.hints);
    for (const label of seg.labels) labels.add(label);
  }
  const uniqueComments = [...new Set(comments.map(normalizeSpace).filter(Boolean))];
  const warnings = [];
  if (uniqueComments.length > 1) warnings.push("segment has more than one comment");
  if (!uniqueComments.length) warnings.push("missing comment");
  const sorted = [...new Set(nights)].sort();
  return finishStay({
    code,
    doors: [...doorNights.keys()].sort(),
    nights: sorted,
    doorNights,
    checkIn: sorted[0],
    checkOut: addDays(sorted[sorted.length - 1], 1),
    comments: uniqueComments,
    hints,
    labels,
    warnings,
    blocking: false,
    today,
  });
}

function finishStay({
  code,
  doors,
  nights,
  doorNights,
  checkIn,
  checkOut,
  comments,
  hints,
  labels,
  warnings,
  blocking,
  today,
}) {
  const raw = comments.join("\n\n");
  const year = Number((checkIn || today).slice(0, 4));
  const parsed = raw ? parseComment(raw, year) : parseComment(code, year);
  const hint = hints.includes("cancelled")
    ? "cancelled"
    : parsed.statusHint || (hints.includes("held") ? "held" : "");
  const doorsFinal = doors.length ? doors : parsed.roomNumbers;
  const map = doorNights ?? new Map();
  if (!doorNights) {
    for (const door of doorsFinal) map.set(door, new Set(nights));
  }
  const allNights = new Set(nights);
  let checkInFinal = checkIn;
  let checkOutFinal = checkOut;
  if (parsed.datePairs?.length && nights.length) {
    const rackNights = new Set(nights);
    const overlap = parsed.datePairs.some(([start, end]) =>
      nightsBetween(start, end).some((date) => rackNights.has(date)),
    );
    const same =
      parsed.datePairs.length === 1 &&
      parsed.datePairs[0][0] === checkIn &&
      parsed.datePairs[0][1] === checkOut;
    if (!overlap) {
      warnings.push("hard date conflict");
      blocking = true;
    } else if (!same) {
      warnings.push("comment dates differ from the rack");
    }
  }
  if (parsed.rateUnparsed) warnings.push("unparsed rate");
  const aliasLabels = [...labels].filter((label) => {
    const door = doorFromLabel(label);
    if (!door) return false;
    const canonical = canonicalRooms().find((r) => r.door === door);
    if (!canonical) return false;
    const primary = canonical.aliases[0];
    return label && label !== primary && label !== door;
  });

  const guest = parsed.guest || (parsed.source === "client" ? code : "");
  const adults = parsed.adults || Math.max(doorsFinal.length, 1);
  if (!parsed.adults) warnings.push("pax not parsed");
  const status = operationalStatus(checkInFinal, checkOutFinal, today, hint);
  const stay = {
    agent_code: code,
    agent_name: parsed.source === "agent" ? parsed.company || code : "",
    source: parsed.source,
    guest_name: guest || `Guest ${code}`,
    nationality: parsed.nationality,
    guest_origin: guestOrigin(parsed.nationality, raw),
    adults,
    check_in: checkInFinal || "",
    check_out: checkOutFinal || "",
    meal_plan_code: parsed.mealCode || "EP",
    meal_as_written: parsed.mealWritten,
    ai_package: parsed.aiPackage ? "yes" : "",
    doors: doorsFinal,
    doorNights: map,
    allNights,
    nights,
    room_labels: doorsFinal.join(", "),
    guide_name: parsed.guideName,
    guide_phone: parsed.guidePhone,
    quoted_total_btn: parsed.quoted ?? "",
    payment_note: paymentNote(raw),
    diet: parsed.diet,
    eta: parsed.eta,
    extra_beds: parsed.extraBeds,
    raw_comment: raw,
    warnings,
    blocking,
    status,
    aliasLabels,
    doorHint: doorsFinal[0] ?? "",
  };
  if (!stay.check_in || !stay.check_out) {
    stay.blocking = true;
    stay.warnings.push("stay has no dates");
  }
  retargetKey(stay);
  return stay;
}

function paymentNote(raw) {
  const lines = String(raw)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /cash|manual|payment|paid|whatsapp|bank/i.test(line));
  return lines.join(" | ").slice(0, 500);
}

export function workbookRows(parsed) {
  const agentMap = new Map();
  for (const stay of parsed.stays) {
    const key = stay.agent_code;
    const row = agentMap.get(key) ?? {
      code: key,
      names: new Map(),
      stays: 0,
      sources: new Map(),
    };
    row.stays += 1;
    row.sources.set(stay.source, (row.sources.get(stay.source) ?? 0) + 1);
    if (stay.agent_name) {
      row.names.set(stay.agent_name, (row.names.get(stay.agent_name) ?? 0) + 1);
    }
    agentMap.set(key, row);
  }

  const agents = [
    ["code", "company_name", "source", "stay_count"],
    ...[...agentMap.values()]
      .sort((a, b) => b.stays - a.stays || a.code.localeCompare(b.code))
      .map((row) => {
        const company =
          [...row.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
        const source =
          [...row.sources.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
          "agent";
        return [row.code, source === "agent" ? company || row.code : "", source, String(row.stays)];
      }),
  ];

  const stays = [
    [
      "stay_key",
      "external_ref",
      "blocking",
      "status",
      "source",
      "agent_code",
      "agent_name",
      "guest_name",
      "nationality",
      "guest_origin",
      "adults",
      "check_in",
      "check_out",
      "meal_plan_code",
      "meal_as_written",
      "ai_package",
      "room_labels",
      "guide_name",
      "guide_phone",
      "quoted_total_btn",
      "payment_note",
      "diet",
      "eta",
      "extra_beds",
      "warnings",
      "raw_comment",
    ],
    ...parsed.stays.map((stay) => [
      stay.stay_key,
      stay.external_ref,
      stay.blocking ? "yes" : "",
      stay.status,
      stay.source,
      stay.agent_code,
      stay.agent_name,
      stay.guest_name,
      stay.nationality,
      stay.guest_origin,
      String(stay.adults),
      stay.check_in,
      stay.check_out,
      stay.meal_plan_code,
      stay.meal_as_written,
      stay.ai_package,
      stay.room_labels,
      stay.guide_name,
      stay.guide_phone,
      stay.quoted_total_btn === "" ? "" : String(stay.quoted_total_btn),
      stay.payment_note,
      stay.diet,
      stay.eta,
      String(stay.extra_beds || 0),
      stay.warnings.join("; "),
      stay.raw_comment,
    ]),
  ];

  const nightRows = [["door", "date", "code", "status", "stay_key"]];
  const stayByNight = new Map();
  for (const stay of parsed.stays) {
    for (const [door, dates] of stay.doorNights) {
      for (const date of dates) stayByNight.set(`${door}|${date}`, stay);
    }
  }
  for (const night of parsed.nights) {
    const stay = stayByNight.get(`${night.door}|${night.date}`);
    nightRows.push([
      night.door,
      night.date,
      night.code,
      stay?.status ?? "",
      stay?.stay_key ?? "",
    ]);
  }

  const review = [
    ["stay_key", "severity", "issue", "detail"],
    ...parsed.review.map((row) => [
      row.stay_key,
      row.severity,
      row.issue,
      row.detail,
    ]),
  ];

  return { agents, stays, nightRows, review };
}
