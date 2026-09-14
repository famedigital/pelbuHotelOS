/**
 * One-shot: copy a DOT assessment onto another star checklist.
 * Usage: node --env-file=.env.local scripts/copy-dot-assessment-star.mjs <sourceId> <3|4>
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog3 = JSON.parse(
  readFileSync(
    join(__dirname, "../src/lib/dot-assessment/catalog/hcs-2024-3star.json"),
    "utf8",
  ),
);
const catalog4 = JSON.parse(
  readFileSync(
    join(__dirname, "../src/lib/dot-assessment/catalog/hcs-2024-4star.json"),
    "utf8",
  ),
);

const catalogs = { 3: catalog3, 4: catalog4 };

function buildMeta(catalog) {
  const meta = new Map();
  for (const g of catalog.entryGate) {
    meta.set(g.code, { sectionKey: "gate", kind: "M", maxPoints: null });
  }
  for (const s of catalog.sections) {
    for (const c of s.criteria) {
      meta.set(c.code, {
        sectionKey: s.key,
        kind: c.kind,
        maxPoints: c.maxPoints,
      });
    }
  }
  return meta;
}

function remap(target, source) {
  if (target.kind === "X") return null;

  let status = source.status;
  let scoreM = source.score_m;
  let scoreQ = source.score_q;
  let scoreP = source.score_p != null ? Number(source.score_p) : null;

  const yes = source.status === "yes" || source.score_m === 1;
  const no = source.status === "no" || source.score_m === 0;

  if (
    target.kind === "P" ||
    (target.kind === "custom" && target.maxPoints != null)
  ) {
    const max = target.maxPoints ?? 0;
    if (scoreP != null && Number.isFinite(scoreP)) {
      scoreP = Math.max(0, Math.min(scoreP, max || scoreP));
      status = source.status === "na" ? "na" : "scored";
      scoreM = null;
    } else if (yes) {
      scoreP = max;
      status = "scored";
      scoreM = null;
    } else if (no) {
      scoreP = 0;
      status = "scored";
      scoreM = null;
    } else if (source.status === "na") {
      status = "na";
      scoreP = null;
      scoreM = null;
    }
  } else if (target.kind === "M") {
    if (yes) {
      status = "yes";
      scoreM = 1;
    } else if (no) {
      status = "no";
      scoreM = 0;
    } else if (scoreP != null && scoreP > 0) {
      status = "yes";
      scoreM = 1;
      scoreP = null;
    } else if (scoreP === 0) {
      status = "no";
      scoreM = 0;
      scoreP = null;
    }
  }

  if (
    status === "pending" &&
    scoreM == null &&
    scoreQ == null &&
    scoreP == null
  ) {
    return null;
  }

  return {
    sectionKey: target.sectionKey,
    status,
    scoreM,
    scoreQ,
    scoreP,
    remarks: source.remarks ?? null,
  };
}

const sourceId = process.argv[2];
const targetStar = Number(process.argv[3]);
if (!sourceId || (targetStar !== 3 && targetStar !== 4)) {
  console.error(
    "Usage: node --env-file=.env.local scripts/copy-dot-assessment-star.mjs <sourceId> <3|4>",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const catalog = catalogs[targetStar];
const meta = buildMeta(catalog);

const { data: source, error: srcErr } = await admin
  .from("dot_assessments")
  .select("*")
  .eq("id", sourceId)
  .single();
if (srcErr) throw srcErr;
if (source.star_level === targetStar) {
  throw new Error(`Already ${targetStar}-star`);
}

const [{ data: resp, error: rErr }, { data: evid, error: eErr }] =
  await Promise.all([
    admin
      .from("dot_assessment_responses")
      .select("*")
      .eq("assessment_id", sourceId),
    admin
      .from("dot_assessment_evidence")
      .select("*")
      .eq("assessment_id", sourceId),
  ]);
if (rErr) throw rErr;
if (eErr) throw eErr;

const noteLine = `Copied from ${source.star_level}★ assessment ${sourceId} → ${targetStar}★ scoring.`;
const notes = source.notes?.trim()
  ? `${source.notes.trim()}\n${noteLine}`
  : noteLine;

const { data: created, error: cErr } = await admin
  .from("dot_assessments")
  .insert({
    property_id: source.property_id,
    star_level: targetStar,
    status: source.status === "archived" ? "in_progress" : source.status,
    catalog_version: catalog.version,
    catalog_source: catalog.sourceFile,
    property_info: source.property_info,
    lead_assessor: source.lead_assessor,
    assessor_2: source.assessor_2,
    assessor_3: source.assessor_3,
    assessed_on: source.assessed_on,
    notes,
    na_sections: source.na_sections,
  })
  .select("id")
  .single();
if (cErr) throw cErr;
const newId = created.id;

const responseRows = [];
for (const r of resp ?? []) {
  const target = meta.get(r.criterion_code);
  if (!target) continue;
  const mapped = remap(target, r);
  if (!mapped) continue;
  responseRows.push({
    assessment_id: newId,
    criterion_code: r.criterion_code,
    section_key: mapped.sectionKey,
    status: mapped.status,
    score_m: mapped.scoreM,
    score_q: mapped.scoreQ,
    score_p: mapped.scoreP,
    remarks: mapped.remarks,
    updated_at: r.updated_at ?? new Date().toISOString(),
  });
}

if (responseRows.length) {
  const { error } = await admin
    .from("dot_assessment_responses")
    .insert(responseRows);
  if (error) throw error;
}

const evidenceRows = (evid ?? [])
  .filter((e) => {
    const t = meta.get(e.criterion_code);
    return t != null && t.kind !== "X";
  })
  .map((e) => ({
    assessment_id: newId,
    criterion_code: e.criterion_code,
    storage_path: e.storage_path,
    file_name: e.file_name,
    mime_type: e.mime_type,
    byte_size: e.byte_size,
    caption: e.caption,
    uploaded_at: e.uploaded_at,
  }));

if (evidenceRows.length) {
  const { error } = await admin
    .from("dot_assessment_evidence")
    .insert(evidenceRows);
  if (error) throw error;
}

console.log(
  JSON.stringify(
    {
      newId,
      from: source.star_level,
      to: targetStar,
      responses: responseRows.length,
      evidence: evidenceRows.length,
      url: `/erp/dot-assessment/${newId}?step=guide`,
    },
    null,
    2,
  ),
);
