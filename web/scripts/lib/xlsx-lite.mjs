/**
 * Minimal xlsx reader/writer for the Olakha rack.
 * Reads deflate/store zips and writes store-only workbooks with inline strings.
 */

import { inflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

export function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not a zip archive.");
  const count = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported.");
  }
  const files = new Map();
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error("Bad zip central directory.");
    }
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;

    if (buf.readUInt32LE(localOff) !== 0x04034b50) {
      throw new Error(`Bad local header for ${name}`);
    }
    const localNameLen = buf.readUInt16LE(localOff + 26);
    const localExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    let data;
    if (method === 0) data = comp;
    else if (method === 8) data = inflateRawSync(comp);
    else throw new Error(`Unsupported zip method ${method} for ${name}`);
    files.set(name, data);
  }
  return files;
}

export function writeZip(fileMap) {
  const parts = [];
  const cds = [];
  let offset = 0;
  for (const [name, data] of fileMap) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    cds.push(Buffer.concat([cd, nameBuf]));
    offset += 30 + nameBuf.length + data.length;
  }
  const cdBuf = Buffer.concat(cds);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(fileMap.size, 8);
  eocd.writeUInt16LE(fileMap.size, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, eocd]);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colLetters(index) {
  let n = index;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetXml(rows) {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (value == null || value === "") return "";
          const ref = `${colLetters(c + 1)}${r + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${body}</sheetData>
</worksheet>`;
}

export function writeWorkbook(filePath, sheets) {
  const files = new Map();
  const sheetNames = sheets.map((s) => s.name);
  files.set(
    "[Content_Types].xml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheetNames
  .map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join("")}
</Types>`),
  );
  files.set(
    "_rels/.rels",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
  );
  files.set(
    "xl/workbook.xml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheetNames
  .map(
    (name, i) =>
      `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  )
  .join("")}
</sheets>
</workbook>`),
  );
  files.set(
    "xl/_rels/workbook.xml.rels",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetNames
  .map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  )
  .join("")}
</Relationships>`),
  );
  sheets.forEach((sheet, i) => {
    files.set(
      `xl/worksheets/sheet${i + 1}.xml`,
      Buffer.from(sheetXml(sheet.rows)),
    );
  });
  writeFileSync(filePath, writeZip(files));
}

export function decodeXml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&amp;/g, "&");
}

export function sharedStrings(xml) {
  const out = [];
  const items = xml.split(/<si\b[^>]*>/i).slice(1);
  for (const item of items) {
    const body = item.split(/<\/si>/i)[0] ?? "";
    const texts = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
      decodeXml(m[1]),
    );
    out.push(texts.join(""));
  }
  return out;
}

export function colIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** @returns {Map<string, { style: string, type: string, value: string }>} */
export function sheetCells(xml, strings) {
  const cells = new Map();
  let i = 0;
  while (i < xml.length) {
    const start = xml.indexOf("<c", i);
    if (start < 0) break;
    const next = xml[start + 2];
    if (next !== " " && next !== "/" && next !== ">") {
      i = start + 2;
      continue;
    }
    const endBracket = xml.indexOf(">", start);
    if (endBracket < 0) break;
    const selfClosing = xml[endBracket - 1] === "/";
    const attrs = xml.slice(start + 2, selfClosing ? endBracket - 1 : endBracket);
    let inner = "";
    if (selfClosing) {
      i = endBracket + 1;
    } else {
      const close = xml.indexOf("</c>", endBracket);
      if (close < 0) break;
      inner = xml.slice(endBracket + 1, close);
      i = close + 4;
    }
    const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!ref) continue;
    const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const style = /s="(\d+)"/.exec(attrs)?.[1] ?? "";
    let value = "";
    if (type === "s") {
      const idx = Number(/<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? "");
      value = strings[idx] ?? "";
    } else if (type === "inlineStr") {
      value = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
        .map((m) => decodeXml(m[1]))
        .join("");
    } else if (type === "str") {
      value = decodeXml(/<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? "");
    } else {
      value = /<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? "";
    }
    cells.set(ref, { style, type, value });
  }
  return cells;
}

export function styleFills(stylesXml) {
  const fillsBlock = /<fills\b[^>]*>([\s\S]*?)<\/fills>/.exec(stylesXml)?.[1] ?? "";
  const fills = [...fillsBlock.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map(
    (m) => {
      const rgb = /fgColor[^>]*rgb="([^"]+)"/.exec(m[1])?.[1] ?? "";
      const theme = /fgColor[^>]*theme="([^"]+)"/.exec(m[1])?.[1] ?? "";
      return rgb || (theme ? `theme:${theme}` : "");
    },
  );
  const xfsBlock =
    /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? "";
  const fillByStyle = [...xfsBlock.matchAll(/<xf\b([^>]*)\/?>/g)].map((m) => {
    const fillId = Number(/fillId="(\d+)"/.exec(m[1])?.[1] ?? 0);
    return fills[fillId] ?? "";
  });
  return fillByStyle;
}

export function workbookSheets(files) {
  const workbook = files.get("xl/workbook.xml").toString("utf8");
  const rels = files.get("xl/_rels/workbook.xml.rels").toString("utf8");
  const relById = new Map();
  for (const match of rels.matchAll(
    /Id="([^"]+)"[^>]*Target="([^"]+)"/g,
  )) {
    const target = match[2].replace(/^\//, "");
    relById.set(
      match[1],
      target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\.\//, "")}`,
    );
  }
  const sheets = [];
  for (const match of workbook.matchAll(
    /<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g,
  )) {
    const path = relById.get(match[2]);
    sheets.push({ name: decodeXml(match[1]), path });
  }
  return sheets;
}

export function threadedComments(xml) {
  const byRef = new Map();
  const re =
    /<x18tc:threadedComment\b([^>]*)>([\s\S]*?)<\/x18tc:threadedComment>/g;
  for (const match of xml.matchAll(re)) {
    const ref = /ref="([^"]+)"/.exec(match[1])?.[1];
    const when = /dT="([^"]+)"/.exec(match[1])?.[1] ?? "";
    const text = decodeXml(
      /<x18tc:text\b[^>]*>([\s\S]*?)<\/x18tc:text>/.exec(match[2])?.[1] ?? "",
    ).trim();
    if (!ref || !text) continue;
    const list = byRef.get(ref) ?? [];
    list.push({ when, text });
    byRef.set(ref, list);
  }
  for (const list of byRef.values()) {
    list.sort((a, b) => a.when.localeCompare(b.when));
  }
  return byRef;
}

export function readXlsxSheets(filePath) {
  const files = readZip(readFileSync(filePath));
  const strings = sharedStrings(
    files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "<sst></sst>",
  );
  const sheets = workbookSheets(files).map((sheet) => {
    const xml = files.get(sheet.path)?.toString("utf8") ?? "";
    return {
      name: sheet.name,
      cells: sheetCells(xml, strings),
    };
  });
  return { sheets };
}

export function rowsFromCells(cells) {
  let maxRow = 0;
  let maxCol = 0;
  for (const ref of cells.keys()) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m) continue;
    maxCol = Math.max(maxCol, colIndex(m[1]));
    maxRow = Math.max(maxRow, Number(m[2]));
  }
  const rows = [];
  for (let r = 1; r <= maxRow; r++) {
    const row = [];
    for (let c = 1; c <= maxCol; c++) {
      row.push(cells.get(`${colLetters(c)}${r}`)?.value ?? "");
    }
    rows.push(row);
  }
  return rows;
}
