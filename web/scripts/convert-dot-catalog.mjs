import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const tmp = process.env.TEMP + "/pelbu-checklists";
const outDir = "C:/GitHub/pelbusuites/web/src/lib/dot-assessment/catalog";
fs.mkdirSync(outDir, { recursive: true });

const SECTION_META = {
  // key, order used for section_key
};

function cellText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((r) => r.text).join("").trim();
    if (v.text) return String(v.text).trim();
    if (v.result != null) return String(v.result).trim();
    if (v.formula) return "";
  }
  return "";
}

function sheetIsEntry(name) {
  return /desk/i.test(name);
}
function sheetIsProperty(name) {
  return /property information/i.test(name);
}
function sheetIsScoring(name) {
  return /^scoring$/i.test(name);
}

function sectionKeyFromSheet(name, order) {
  const map = {
    "general hotel information": "general",
    "general services": "general",
    "reception & services": "reception",
    bedroom: "bedroom",
    bathroom: "bathroom",
    "food and beverages": "fnb",
    "food & beverage": "fnb",
    kitchen: "kitchen",
    "kitchen operation": "kitchen",
    "health & safety": "health",
    "health and safety": "health",
    "environmental practices": "environment",
    "quality control & online activi": "quality",
    "human resources": "hr",
    "recreational facilities": "recreation",
    "recreational facilities ": "recreation",
    "event facilities mice": "mice",
  };
  const k = map[name.trim().toLowerCase()];
  return k || `s${order}`;
}

function parseKind(ind) {
  const t = (ind || "").trim();
  if (t === "M") return { kind: "M" };
  if (t === "Q") return { kind: "Q" };
  if (t === "X") return { kind: "X" };
  if (/^\d+$/.test(t)) return { kind: "P", maxPoints: Number(t) };
  if (t) return { kind: "custom", notes: t };
  return { kind: "custom", notes: "" };
}

async function convert(file, starLevel, sourceFile) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(tmp, file));

  const propertyFields = [];
  const entryGate = [];
  const sections = [];
  let order = 0;

  for (const ws of wb.worksheets) {
    const name = ws.name;
    if (sheetIsScoring(name)) continue;

    if (sheetIsProperty(name)) {
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const label = cellText(row.getCell(2).value);
        const sub = cellText(row.getCell(3).value);
        if (!label) return;
        const base = [label, sub]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
          .slice(0, 48);
        let key = base || `field_${rowNumber}`;
        const existing = new Set(propertyFields.map((f) => f.key));
        if (existing.has(key)) key = `${key}_${rowNumber}`;
        propertyFields.push({
          key,
          label: sub ? `${label.replace(/:$/, "")} — ${sub}` : label,
          subLabel: sub || null,
        });
      });
      continue;
    }

    if (sheetIsEntry(name)) {
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const no = cellText(row.getCell(1).value);
        const text = cellText(row.getCell(2).value);
        if (!no || !text || no === "Sl. No") return;
        entryGate.push({
          code: `gate.${no}`,
          no: Number(no) || no,
          text,
          kind: "M",
        });
      });
      continue;
    }

    // Physical section
    order += 1;
    const sectionKey = sectionKeyFromSheet(name, order);
    const section = {
      key: sectionKey,
      sheetName: name,
      order,
      code: null,
      title: name,
      caps: { M: null, Q: null, P: null },
      groups: [],
      criteria: [],
    };

    let currentGroup = null;

    ws.eachRow({ includeEmpty: false }, (row) => {
      const no = cellText(row.getCell(1).value).replace(/\.$/, "");
      const crit = cellText(row.getCell(2).value);
      const ind = cellText(row.getCell(3).value);
      const c4 = cellText(row.getCell(4).value);
      const c5 = cellText(row.getCell(5).value);
      const c6 = cellText(row.getCell(6).value);

      if (/^\d+$/.test(no) && crit && !/assessment criteria|no indicator/i.test(crit)) {
        section.code = no;
        section.title = crit;
        if (c4 && /^\d+$/.test(c4)) section.caps.M = Number(c4);
        if (c5 && /^\d+$/.test(c5)) section.caps.Q = Number(c5);
        if (c6 && /^\d+$/.test(c6)) section.caps.P = Number(c6);
        return;
      }

      if (/^\d+\.\d+$/.test(no) && crit) {
        currentGroup = { code: no, title: crit };
        section.groups.push(currentGroup);
        return;
      }

      if (/^\d+\.\d+\.\d+$/.test(no) && crit) {
        const parsed = parseKind(ind);
        section.criteria.push({
          code: no,
          text: crit,
          kind: parsed.kind,
          maxPoints: parsed.maxPoints ?? null,
          notes: parsed.notes ?? null,
          groupCode: currentGroup?.code ?? null,
        });
      }
    });

    sections.push(section);
  }

  const mRequiredOfficial = starLevel === 3 ? 163 : 192;
  const leafM = sections.reduce(
    (n, s) => n + s.criteria.filter((c) => c.kind === "M").length,
    0,
  );
  const leafTotal = sections.reduce((n, s) => n + s.criteria.length, 0);

  const catalog = {
    version: "hcs-2024",
    sourceFile,
    sourceDate: "2025-09-08",
    starLevel,
    title:
      starLevel === 3
        ? "Assessment Checklist (3 Star Hotels)"
        : "Assessment Checklist (4 Star Hotels — Premium)",
    scoring: {
      mandatoryRequired: mRequiredOfficial,
      qualityBandMode: starLevel === 3 ? "absolute_optional_and_pct_quality" : "percent",
      // From official scoring sheet
      qualityBands3Star: starLevel === 3
        ? [
            { rank: 5, label: "Excellent", min: 116, max: 145 },
            { rank: 4, label: "Very Good", min: 86, max: 115 },
            { rank: 3, label: "Good (Basic Standard)", min: 56, max: 85 },
            { rank: 2, label: "Fair", min: 26, max: 55 },
            { rank: 1, label: "Poor", max: 25 },
          ]
        : null,
      percentBands: [
        { rank: 5, label: "Excellent", minPct: 80, maxPct: 100 },
        { rank: 4, label: "Very Good", minPct: 60, maxPct: 79 },
        { rank: 3, label: "Good (Basic Standard)", minPct: 40, maxPct: 59 },
        { rank: 2, label: "Fair", minPct: 20, maxPct: 39 },
        { rank: 1, label: "Poor", minPct: 1, maxPct: 19 },
      ],
    },
    propertyFields,
    entryGate,
    sections,
    stats: {
      leafCriteria: leafTotal,
      mandatoryLeafCount: leafM,
      entryGateCount: entryGate.length,
      sectionCount: sections.length,
    },
  };

  const outName = starLevel === 3 ? "hcs-2024-3star.json" : "hcs-2024-4star.json";
  fs.writeFileSync(path.join(outDir, outName), JSON.stringify(catalog, null, 2));
  console.log(
    outName,
    "sections",
    sections.length,
    "leaves",
    leafTotal,
    "M leaves",
    leafM,
    "gate",
    entryGate.length,
    "property",
    propertyFields.length,
  );
  return catalog;
}

await convert("3star-clean.xlsx", 3, "checklist-3-star-08092025.xlsx");
await convert("4star-clean.xlsx", 4, "checklist-4-star-08092025.xlsx");
