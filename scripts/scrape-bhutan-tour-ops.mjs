/**
 * Scrape certified tour operators from services.bhutan.travel into CSV.
 *
 * Usage:
 *   node scripts/scrape-bhutan-tour-ops.mjs
 *   node scripts/scrape-bhutan-tour-ops.mjs --dzongkhag=Thimphu
 *   node scripts/scrape-bhutan-tour-ops.mjs --locations=1
 *
 * --dzongkhag / --locations filters the TCB list by office dzongkhag
 * (Thimphu = locations id 1). Also writes a Mailchimp-friendly seed when filtered.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "docs", "exports");
const MAILCHIMP_DIR = join(ROOT, "marketing", "mailchimp");
const BASE = "https://services.bhutan.travel/search/tour-operator";
const UA = "PelbuSuites-research/1.0 (+hotel partner research; respectful crawl)";

const LOCATION_IDS = {
  thimphu: 1,
  paro: 2,
  punakha: 3,
  chhukha: 4,
  haa: 5,
  samtse: 6,
  dagana: 7,
  gasa: 8,
  tsirang: 9,
  "wangdue phodrang": 10,
  bumthang: 11,
  sarpang: 12,
  trongsa: 13,
  zhemgang: 14,
  lhuntse: 15,
  mongar: 16,
  "pema gatshel": 17,
  "samdrup jongkhar": 18,
  trashigang: 19,
  "trashi yangtse": 20,
};

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function unescapeInertia(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchInertia(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const raw = await res.text();
  const m = raw.match(/data-page="([^"]+)"/);
  if (!m) throw new Error(`No Inertia data-page on ${url}`);
  return JSON.parse(unescapeInertia(m[1]));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(path, fieldnames, rows) {
  const lines = [fieldnames.join(",")];
  for (const row of rows) {
    lines.push(fieldnames.map((f) => csvEscape(row[f] ?? "")).join(","));
  }
  writeFileSync(path, "\ufeff" + lines.join("\n") + "\n", "utf8");
}

function resolveLocationFilter() {
  const byId = argValue("--locations=");
  const byName = argValue("--dzongkhag=");
  if (byId) {
    const id = Number(byId);
    if (!Number.isFinite(id)) throw new Error(`Invalid --locations=${byId}`);
    const name =
      Object.entries(LOCATION_IDS).find(([, v]) => v === id)?.[0] ?? `id-${id}`;
    return {
      id,
      name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  }
  if (byName) {
    const key = byName.trim().toLowerCase();
    const id = LOCATION_IDS[key];
    if (!id) {
      throw new Error(
        `Unknown dzongkhag "${byName}". Known: ${Object.keys(LOCATION_IDS).join(", ")}`,
      );
    }
    return {
      id,
      name: byName.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  }
  return null;
}

function normalizeRow(item, dzongkhag) {
  const slug = (item.slug ?? "").toString().trim();
  const phone = (item.contact ?? item.phone ?? item.mobile ?? "")
    .toString()
    .trim();
  return {
    id: item.id != null ? String(item.id) : "",
    name: (item.name ?? item.company_name ?? "").toString().trim(),
    phone: phone ? (phone.startsWith("+") ? phone : `+975 ${phone}`) : "",
    email: (item.email ?? "").toString().trim(),
    website: (item.website ?? "").toString().trim(),
    slug,
    dzongkhag: dzongkhag ?? "",
    source_url: slug ? `${BASE}/${slug}` : "",
  };
}

const location = resolveLocationFilter();
const listUrl = location
  ? `${BASE}?locations[]=${location.id}`
  : BASE;

console.log(
  location
    ? `Filtering TCB operators by office dzongkhag: ${location.name} (locations[]=${location.id})`
    : "Scraping all TCB tour operators (no location filter)",
);

const first = await fetchInertia(listUrl);
const results = first.props.results;
if (!results?.data) {
  throw new Error(`No results paginator. props: ${Object.keys(first.props)}`);
}

const lastPage = Number(results.last_page || 1);
const total = Number(results.total || 0);
console.log(`Pagination: total=${total} last_page=${lastPage} per_page=${results.per_page}`);

const rows = [];
const seen = new Set();

for (let page = 1; page <= lastPage; page += 1) {
  let paginator = results;
  if (page > 1) {
    await sleep(600);
    const qs = new URLSearchParams();
    if (location) qs.set("locations[]", String(location.id));
    qs.set("page", String(page));
    const data = await fetchInertia(`${BASE}?${qs.toString()}`);
    paginator = data.props.results;
  }
  const items = paginator?.data || [];
  console.log(`Page ${page}/${lastPage}: ${items.length} items`);
  for (const item of items) {
    const row = normalizeRow(item, location?.name ?? "");
    const key = `${row.name.toLowerCase()}|${row.email.toLowerCase()}|${row.phone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.name || row.email || row.phone) rows.push(row);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const fieldnames = [
  "id",
  "name",
  "phone",
  "email",
  "website",
  "slug",
  "dzongkhag",
  "source_url",
];

const suffix = location
  ? `-${location.name.toLowerCase().replace(/\s+/g, "-")}`
  : "";
const csvPath = join(OUT_DIR, `bhutan-tour-operators${suffix}.csv`);
writeCsv(csvPath, fieldnames, rows);

const contactsPath = join(
  OUT_DIR,
  `bhutan-tour-operators${suffix}-contacts.csv`,
);
writeCsv(contactsPath, ["name", "phone", "email", "dzongkhag"], rows);

// Keep unfiltered main export name when no filter (compat with import script)
if (!location) {
  writeCsv(join(OUT_DIR, "bhutan-tour-operators.csv"), fieldnames, rows);
}

if (location) {
  mkdirSync(MAILCHIMP_DIR, { recursive: true });
  const mailPath = join(
    MAILCHIMP_DIR,
    `${location.name.toLowerCase().replace(/\s+/g, "-")}-travel-agents-seed.csv`,
  );
  const mailRows = rows.map((r) => ({
    "Email Address": r.email,
    "First Name": "",
    "Last Name": "",
    Company: r.name,
    Phone: r.phone,
    City: r.dzongkhag,
    State: "",
    Address: "",
    Website: r.website,
    Tags: `bhutan-agent;tcb-directory;${r.dzongkhag.toLowerCase()}-agent`,
    Source: "tcb-portal",
    Notes: r.source_url ? `TCB ${r.source_url}` : "TCB directory",
  }));
  writeCsv(
    mailPath,
    [
      "Email Address",
      "First Name",
      "Last Name",
      "Company",
      "Phone",
      "City",
      "State",
      "Address",
      "Website",
      "Tags",
      "Source",
      "Notes",
    ],
    mailRows,
  );
  console.log(`Mailchimp seed: ${mailPath}`);
}

const missingEmail = rows.filter((r) => !r.email).length;
const missingPhone = rows.filter((r) => !r.phone).length;
console.log(`\nWrote ${rows.length} operators`);
console.log(`  ${csvPath}`);
console.log(`  ${contactsPath}`);
console.log(`Missing email: ${missingEmail}, missing phone: ${missingPhone}`);
