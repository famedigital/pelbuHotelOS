/**
 * Import Bhutan Tourism Council (TCB) tour operators into agents as status=directory.
 *
 * - credit_limit=0, can_login=false, market=bhutan, rate_tier=public
 * - notes: source:tcb + website/slug/source_url/tcb_id
 * - Idempotent: match lower(email) or lower(company_name); update directory only;
 *   never overwrite approved/demo/rejected trade partners
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/import-tcb-tour-operators.mjs
 *   node --env-file=.env.local scripts/import-tcb-tour-operators.mjs --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const CSV_PATH = join(ROOT, "docs/exports/bhutan-tour-operators.csv");
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 50;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.length > 1 || (row[0] ?? "").trim() !== "") rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normKey(value) {
  return (value ?? "").trim().toLowerCase();
}

function buildNotes(row) {
  const lines = ["source:tcb"];
  if (row.website) lines.push(`website:${row.website}`);
  if (row.slug) lines.push(`slug:${row.slug}`);
  if (row.source_url) lines.push(`source_url:${row.source_url}`);
  if (row.id) lines.push(`tcb_id:${row.id}`);
  return lines.join("\n");
}

function isTcbDirectory(agent) {
  if (agent.status === "directory") return true;
  const notes = (agent.notes ?? "").toLowerCase();
  return notes.includes("source:tcb");
}

const raw = readFileSync(CSV_PATH, "utf8");
const table = parseCsv(raw);
if (table.length < 2) {
  console.error("CSV empty or missing header:", CSV_PATH);
  process.exit(1);
}

const header = table[0].map((h) => h.trim().toLowerCase());
const idx = (name) => header.indexOf(name);
const col = {
  id: idx("id"),
  name: idx("name"),
  phone: idx("phone"),
  email: idx("email"),
  website: idx("website"),
  slug: idx("slug"),
  source_url: idx("source_url"),
};
if (col.name < 0) {
  console.error("CSV missing name column");
  process.exit(1);
}

const operators = [];
for (let r = 1; r < table.length; r++) {
  const cells = table[r];
  const name = (cells[col.name] ?? "").trim();
  if (!name) continue;
  const get = (k) =>
    col[k] >= 0 ? (cells[col[k]] ?? "").trim() || null : null;
  operators.push({
    id: get("id"),
    name,
    phone: get("phone"),
    email: get("email"),
    website: get("website"),
    slug: get("slug"),
    source_url: get("source_url"),
  });
}

console.log(
  `Parsed ${operators.length} operators from ${CSV_PATH}${DRY_RUN ? " (dry-run)" : ""}`,
);

// Page through all agents for match maps
const byEmail = new Map();
const byCompany = new Map();
const pageSize = 1000;
let from = 0;
for (;;) {
  const { data, error } = await admin
    .from("agents")
    .select(
      "id, company_name, contact_email, contact_phone, status, notes, market, rate_tier, credit_limit, can_login",
    )
    .order("id")
    .range(from, from + pageSize - 1);
  if (error) {
    console.error("Failed to load agents:", error.message);
    process.exit(1);
  }
  const batch = data ?? [];
  for (const a of batch) {
    const emailKey = normKey(a.contact_email);
    if (emailKey) byEmail.set(emailKey, a);
    const companyKey = normKey(a.company_name);
    if (companyKey) byCompany.set(companyKey, a);
  }
  if (batch.length < pageSize) break;
  from += pageSize;
}

console.log(
  `Loaded ${byEmail.size} email keys / ${byCompany.size} company keys from agents`,
);

let inserted = 0;
let updated = 0;
let skippedTrade = 0;
let skippedNoop = 0;
const toInsert = [];
const toUpdate = [];

for (const op of operators) {
  const emailKey = normKey(op.email);
  const companyKey = normKey(op.name);
  const match =
    (emailKey && byEmail.get(emailKey)) ||
    (companyKey && byCompany.get(companyKey)) ||
    null;

  const payload = {
    company_name: op.name,
    market: "bhutan",
    contact_name: null,
    contact_phone: op.phone,
    contact_email: op.email,
    notes: buildNotes(op),
    status: "directory",
    rate_tier: "public",
    credit_limit: 0,
    credit_used: 0,
    can_login: false,
    wants_mou: false,
  };

  if (!match) {
    toInsert.push(payload);
    // Reserve keys so duplicate CSV rows collapse
    if (emailKey) byEmail.set(emailKey, { ...payload, id: "pending" });
    if (companyKey) byCompany.set(companyKey, { ...payload, id: "pending" });
    continue;
  }

  if (!isTcbDirectory(match) && match.status !== "pending") {
    // Never clobber approved/demo/rejected (or non-TCB pending applications)
    if (match.status === "approved" || match.status === "demo") {
      skippedTrade += 1;
      continue;
    }
    if (match.status === "rejected") {
      skippedTrade += 1;
      continue;
    }
    if (match.status === "pending" && !isTcbDirectory(match)) {
      skippedTrade += 1;
      continue;
    }
  }

  const same =
    match.status === "directory" &&
    normKey(match.company_name) === companyKey &&
    normKey(match.contact_email) === emailKey &&
    (match.contact_phone ?? null) === (op.phone ?? null) &&
    (match.notes ?? "") === payload.notes &&
    Number(match.credit_limit ?? 0) === 0 &&
    match.can_login === false &&
    match.market === "bhutan" &&
    match.rate_tier === "public";

  if (same) {
    skippedNoop += 1;
    continue;
  }

  // Update directory (or prior TCB pending) rows only
  toUpdate.push({ id: match.id, ...payload });
}

if (DRY_RUN) {
  console.log({
    wouldInsert: toInsert.length,
    wouldUpdate: toUpdate.length,
    skippedTrade,
    skippedNoop,
  });
  process.exit(0);
}

for (let i = 0; i < toInsert.length; i += BATCH) {
  const chunk = toInsert.slice(i, i + BATCH);
  const { error } = await admin.from("agents").insert(chunk);
  if (error) {
    console.error(`Insert batch ${i} failed:`, error.message);
    process.exit(1);
  }
  inserted += chunk.length;
  process.stdout.write(`\rInserted ${inserted}/${toInsert.length}`);
}
if (toInsert.length) process.stdout.write("\n");

for (let i = 0; i < toUpdate.length; i += BATCH) {
  const chunk = toUpdate.slice(i, i + BATCH);
  for (const row of chunk) {
    const { id, ...patch } = row;
    // Keep credit_used if somehow non-zero; force limit 0 / no login
    const { error } = await admin
      .from("agents")
      .update({
        company_name: patch.company_name,
        market: patch.market,
        contact_phone: patch.contact_phone,
        contact_email: patch.contact_email,
        notes: patch.notes,
        status: "directory",
        rate_tier: patch.rate_tier,
        credit_limit: 0,
        can_login: false,
        wants_mou: false,
      })
      .eq("id", id);
    if (error) {
      console.error(`Update ${id} failed:`, error.message);
      process.exit(1);
    }
    updated += 1;
  }
  process.stdout.write(`\rUpdated ${updated}/${toUpdate.length}`);
}
if (toUpdate.length) process.stdout.write("\n");

console.log(
  JSON.stringify(
    {
      ok: true,
      inserted,
      updated,
      skippedTrade,
      skippedNoop,
      totalCsv: operators.length,
    },
    null,
    2,
  ),
);
