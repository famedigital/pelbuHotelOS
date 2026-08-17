/**
 * Build Pelbu call-shortlist of ~100 Thimphu agents from Google review signals,
 * matched to TCB Thimphu contacts. Writes two printable HTML pages (1–50 / 51–100).
 *
 *   node scripts/build-thimphu-call-shortlist.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CSV = join(ROOT, "docs/exports/bhutan-tour-operators-thimphu.csv");
const OUT = join(ROOT, "marketing/print");

/** Google-surfaced signals (TripAdvisor / TourRadar / Google Reviews / forums). Rank = priority. */
const GOOGLE_RANKED = [
  { name: "Keys To Bhutan", signal: "TripAdvisor ~684 reviews (claimed on site)", tier: "A", source: "https://www.keystobhutan.com/guest-feedback/" },
  { name: "Bhutan Best Travel", signal: "234+ 5★ reviews (site); TripAdvisor/Google cited", tier: "A", source: "https://bhutanbesttravel.com/" },
  { name: "Bhutan Acorn Tours & Travel", signal: "TourRadar 5.0 · 133 reviews · HQ Thimphu", tier: "A", source: "https://www.tourradar.com/o/bhutan-acorn-tours-travel" },
  { name: "Druk Asia", signal: "TripAdvisor Travellers Choice 2023–25; Google 268+ reviews", tier: "A", source: "https://www.drukasia.com/about-us/" },
  { name: "World Tour Plan", signal: "TourRadar 4.9 · 90 reviews · HQ Thimphu", tier: "A", source: "https://www.tourradar.com/o/world-tour-plan" },
  { name: "Happiness Kingdom Travels", signal: "Google 5.0 · 200 reviews (claimed); 25+ yrs Thimphu", tier: "A", source: "https://bhutanhappiness.com/" },
  { name: "MyBhutan", signal: "TripAdvisor Travellers Choice; luxury Thimphu outfitter", tier: "A", source: "https://www.mybhutan.com/" },
  { name: "Bhutan Best Inbound Tour", signal: "TourRadar 5.0 · 37 reviews · HQ Thimphu", tier: "A", source: "https://www.tourradar.com/o/bhutan-best-inbound-tour" },
  { name: "Book Bhutan Tour", signal: "TripAdvisor Thimphu attraction · strong recent 5★ reviews", tier: "A", source: "https://www.tripadvisor.in/Attraction_Review-g293845-d12683464-Reviews-Book_Bhutan_Tour-Thimphu_Thimphu_District.html" },
  { name: "Found Bhutan Tours & Treks", signal: "TripAdvisor 5★ Thimphu licensed operator", tier: "A", source: "https://foundbht.com/bhutan-travel-agency" },
  { name: "Yangphel Adventure Travel", signal: "Long-standing pioneer; widely recommended", tier: "A", source: "https://aboutbhutan.com/" },
  { name: "Wind Horse Tours", signal: "Est. 1998; frequent TripAdvisor/forum shortlist", tier: "A", source: "https://www.windhorsetours.com/bhutan/" },
  { name: "Heavenly Bhutan Travels", signal: "Active DMC; 16+ yrs; B2B + guest reviews", tier: "A", source: "https://www.heavenlybhutan.com/" },
  { name: "Maebar Travel", signal: "TripAdvisor forum shortlist; Google + TA 5★ claimed", tier: "A", source: "https://maebartravel.com/" },
  { name: "Bhutan Swallowtail", signal: "TripAdvisor forum shortlist; private luxury tours since 2011", tier: "A", source: "https://www.bhutanswallowtail.com/" },
  { name: "Bhutan Karma Trails", signal: "TripAdvisor forum shortlist; strong guest testimonials", tier: "A", source: "https://bhutankarmatrails.com/" },
  { name: "Bhutan Travel Club", signal: "TripAdvisor Thimphu 5.0 listing", tier: "A", source: "https://www.tripadvisor.co.uk/Attraction_Review-g293845-d10036194-Reviews-Bhutan_Travel_Club-Thimphu_Thimphu_District.html" },
  { name: "Bridge To Bhutan", signal: "TripAdvisor forum shortlist; Thimphu social-enterprise operator", tier: "A", source: "https://profile.hellotravel.com/bridgetobhutan" },
  { name: "Ambo Tours & Travels", signal: "DOT licensed Thimphu; 5★ verified reviews claimed", tier: "A", source: "https://www.ambotours.com/" },
  { name: "Bhutan Dhenzang Travel & Tours", signal: "Licensed Thimphu; detailed TripAdvisor-style guest writeups", tier: "A", source: "https://bhutantraveltours.com/" },
  { name: "Om Travenza Tours", signal: "LCC DMC network; Olakha Thimphu boutique DMC", tier: "A", source: "https://lcc-dmc.com/destination-experts/om-travenza-tours/" },
  { name: "Book My Tour", signal: "TripAdvisor Thimphu 5.0 listing", tier: "A", source: "https://www.tripadvisor.co.uk/Attraction_Review-g293845-d15672505-Reviews-Book_My_Tour-Thimphu_Thimphu_District.html" },
  { name: "Keys to Bhutan", signal: "alias Keys To Bhutan", tier: "A", source: "https://www.keystobhutan.com/guest-feedback/" },
  // Pelbu-active (bringing guests to us) — treat as high priority for calling
  { name: "Yak Holidays International", signal: "Pelbu active: 34 bookings (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Southeast Himalaya Adventure", signal: "Pelbu active: 33 bookings (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Bhutan-Bhutan Travel", signal: "Pelbu active: 16 bookings (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Kuenga Rawa Tours and Travels", signal: "Pelbu active: 9 bookings (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Trekking In Bhutan", signal: "Pelbu active: 7 bookings (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Active Bhutan Tours and Treks", signal: "Pelbu active: 6 bookings (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Journey DMC Bhutan", signal: "Pelbu active: 5 bookings (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Destiny Bhutan", signal: "Pelbu active: 5 bookings (18m) · est. 2008", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Drukyul Diaries", signal: "Pelbu active: 2 bookings (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Bhutan Travel Experts", signal: "Pelbu active: 1 booking (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  { name: "Maya Himalaya Travels", signal: "Pelbu active: 1 booking (18m)", tier: "A-pelbu", source: "pelbu-bookings" },
  // Broader Google / marketplace / brand presence (Tier B)
  { name: "Absolute Bhutan", signal: "Widely listed licensed operator (directories + packages)", tier: "B", source: "google" },
  { name: "Etho Metho Tours", signal: "Long-established brand in Bhutan operator lists", tier: "B", source: "google" },
  { name: "Blue Poppy Tours", signal: "Frequently listed Thimphu operator", tier: "B", source: "google" },
  { name: "Gangri Trails", signal: "Adventure brand often cited online", tier: "B", source: "google" },
  { name: "Norbu Bhutan Travel", signal: "Directory / marketplace presence", tier: "B", source: "google" },
  { name: "The Raven's Flight", signal: "Listed Thimphu operator directories", tier: "B", source: "google" },
  { name: "Adventure Himalayan Travels", signal: "TourRadar best companies · 4.5 · 143 reviews", tier: "B", source: "https://www.tourradar.com/d/bhutan" },
  { name: "Bhutan Luxury Tour", signal: "Google shortlist · highly rated packages", tier: "B", source: "google" },
  { name: "Bhutan Travel Adventures", signal: "Google shortlist · logistics / FIT", tier: "B", source: "google" },
  { name: "Teem Travel Bhutan", signal: "Cited as licensed Thimphu operator in how-to guides", tier: "B", source: "google" },
  { name: "Trekkup Bhutan", signal: "Cited as licensed Thimphu operator in how-to guides", tier: "B", source: "google" },
];

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

function norm(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(s) {
  return norm(s)
    .split(" ")
    .filter((t) => t.length > 2 && !["the", "and", "tours", "tour", "travel", "travels", "bhutan", "agency", "operator", "private", "ltd", "pvt"].includes(t));
}

function scoreMatch(query, candidate) {
  const qn = norm(query);
  const cn = norm(candidate);
  if (!qn || !cn) return 0;
  if (qn === cn) return 100;
  if (cn.includes(qn) || qn.includes(cn)) return 90;
  const qt = tokens(query);
  const ct = new Set(tokens(candidate));
  if (!qt.length) return 0;
  let hit = 0;
  for (const t of qt) if (ct.has(t)) hit += 1;
  return Math.round((hit / qt.length) * 80);
}

const table = parseCsv(readFileSync(CSV, "utf8"));
const header = table[0].map((h) => h.trim().toLowerCase());
const col = (n) => header.indexOf(n);
const contacts = table.slice(1).map((r) => ({
  name: (r[col("name")] ?? "").trim(),
  phone: (r[col("phone")] ?? "").trim(),
  email: (r[col("email")] ?? "").trim(),
  website: (r[col("website")] ?? "").trim(),
  slug: (r[col("slug")] ?? "").trim(),
  source_url: (r[col("source_url")] ?? "").trim(),
}));

const used = new Set();
const shortlist = [];

for (const g of GOOGLE_RANKED) {
  let best = null;
  let bestScore = 0;
  for (const c of contacts) {
    if (used.has(c.name)) continue;
    const s = scoreMatch(g.name, c.name);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  if (best && bestScore >= 55) {
    used.add(best.name);
    shortlist.push({
      ...best,
      googleName: g.name,
      signal: g.signal,
      tier: g.tier,
      evidence: g.source,
      matchScore: bestScore,
    });
  } else {
    // Keep Google-only row so sales still has a target name/URL
    shortlist.push({
      name: g.name,
      phone: "",
      email: "",
      website: g.source.startsWith("http") ? g.source : "",
      slug: "",
      source_url: g.source.startsWith("http") ? g.source : "",
      googleName: g.name,
      signal: g.signal + " · contact not matched in TCB Thimphu CSV",
      tier: g.tier,
      evidence: g.source,
      matchScore: 0,
    });
  }
}

// Fill to 100: Thimphu TCB operators with website (active online presence), excluding used
const fillers = contacts
  .filter((c) => !used.has(c.name) && c.website && c.email && c.phone)
  .sort((a, b) => a.name.localeCompare(b.name));

for (const c of fillers) {
  if (shortlist.length >= 100) break;
  used.add(c.name);
  shortlist.push({
    ...c,
    googleName: c.name,
    signal: "TCB Thimphu + public website (secondary fill — verify reviews before call)",
    tier: "C",
    evidence: c.source_url || c.website,
    matchScore: 100,
  });
}

const top100 = shortlist.slice(0, 100);

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageHtml(rows, pageNo, from, to) {
  const title = `Pelbu · Thimphu agent call shortlist · ${from}–${to}`;
  const cards = rows
    .map((r, i) => {
      const n = from + i;
      const tierLabel =
        r.tier === "A"
          ? "Google reviews"
          : r.tier === "A-pelbu"
            ? "Pelbu guests"
            : r.tier === "B"
              ? "Google brand"
              : "TCB + web";
      return `<article class="card">
  <div class="rank">${n}</div>
  <div class="body">
    <h2>${esc(r.name)}</h2>
    <p class="tier"><span>${esc(tierLabel)}</span> ${esc(r.signal)}</p>
    <dl>
      <div><dt>Phone</dt><dd>${r.phone ? `<a href="tel:${esc(r.phone.replace(/\s+/g, ""))}">${esc(r.phone)}</a>` : "—"}</dd></div>
      <div><dt>Email</dt><dd>${r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : "—"}</dd></div>
      <div><dt>Web</dt><dd>${r.website ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">${esc(r.website.replace(/^https?:\/\//, "").slice(0, 42))}</a>` : "—"}</dd></div>
    </dl>
    <p class="note">Evidence: ${esc(r.evidence)}</p>
  </div>
</article>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    :root {
      --ink: #1c1410;
      --muted: #6b5e52;
      --line: #e6ddd2;
      --paper: #fbf7f1;
      --card: #fffdf9;
      --accent: #8b3a2a;
      --gold: #b8893a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background: var(--paper);
      line-height: 1.4;
    }
    header {
      padding: 28px 28px 18px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, #fff 0%, var(--paper) 100%);
    }
    header .kicker {
      margin: 0 0 6px;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 700;
    }
    header h1 {
      margin: 0;
      font-size: 26px;
      letter-spacing: -0.02em;
    }
    header p {
      margin: 8px 0 0;
      max-width: 72ch;
      color: var(--muted);
      font-size: 14px;
    }
    .meta {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
    }
    .meta span {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 4px 10px;
      color: var(--muted);
    }
    .nav {
      margin-top: 14px;
      font-size: 13px;
    }
    .nav a { color: var(--accent); font-weight: 600; }
    main {
      padding: 18px 20px 40px;
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr;
    }
    @media (min-width: 900px) {
      main { grid-template-columns: 1fr 1fr; }
    }
    .card {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 10px;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
      break-inside: avoid;
    }
    .rank {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #1c1410;
      color: #fffaf3;
      display: grid;
      place-items: center;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .body h2 {
      margin: 0;
      font-size: 15px;
      line-height: 1.25;
    }
    .tier {
      margin: 4px 0 8px;
      font-size: 12px;
      color: var(--muted);
    }
    .tier span {
      display: inline-block;
      margin-right: 6px;
      padding: 1px 7px;
      border-radius: 999px;
      border: 1px solid #ead7b3;
      background: #f8efde;
      color: #7a5a22;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    dl {
      margin: 0;
      display: grid;
      gap: 4px;
      font-size: 12.5px;
    }
    dl div { display: grid; grid-template-columns: 52px 1fr; gap: 6px; }
    dt { color: var(--muted); }
    dd { margin: 0; word-break: break-word; }
    a { color: var(--ink); }
    .note {
      margin: 8px 0 0;
      font-size: 11px;
      color: var(--muted);
    }
    footer {
      padding: 0 28px 28px;
      color: var(--muted);
      font-size: 12px;
    }
    @media print {
      body { background: #fff; }
      header { break-after: avoid; }
      .card { box-shadow: none; }
      a { text-decoration: none; }
    }
  </style>
</head>
<body>
  <header>
    <p class="kicker">Pelbu Suites · Agent outreach</p>
    <h1>Thimphu call shortlist · Page ${pageNo}</h1>
    <p>
      Agents ${from}–${to} of 100. Prioritised from Google-visible review / marketplace signals
      (TripAdvisor, TourRadar, Google Reviews, traveler forums), then Pelbu booking activity,
      then TCB Thimphu operators with a public website. Verify reviews on the call before pitching.
    </p>
    <div class="meta">
      <span>Office: Thimphu</span>
      <span>Target: lunch / rates invite</span>
      <span>Generated: ${new Date().toISOString().slice(0, 10)}</span>
    </div>
    <p class="nav">
      ${pageNo === 1
        ? `<strong>Page 1 (1–50)</strong> · <a href="thimphu-call-shortlist-51-100.html">Page 2 (51–100) →</a>`
        : `<a href="thimphu-call-shortlist-1-50.html">← Page 1 (1–50)</a> · <strong>Page 2 (51–100)</strong>`}
    </p>
  </header>
  <main>
${cards}
  </main>
  <footer>
    Sources include TourRadar Bhutan operator ratings, TripAdvisor Thimphu attraction reviews,
    operator sites claiming Google/TA volume, and Pelbu booking history. Not a TCB endorsement.
    Contacts matched from TCB Thimphu directory export where possible.
  </footer>
</body>
</html>`;
}

mkdirSync(OUT, { recursive: true });
const p1 = top100.slice(0, 50);
const p2 = top100.slice(50, 100);
const f1 = join(OUT, "thimphu-call-shortlist-1-50.html");
const f2 = join(OUT, "thimphu-call-shortlist-51-100.html");
writeFileSync(f1, pageHtml(p1, 1, 1, 50), "utf8");
writeFileSync(f2, pageHtml(p2, 2, 51, 100), "utf8");

const tierCounts = top100.reduce((acc, r) => {
  acc[r.tier] = (acc[r.tier] || 0) + 1;
  return acc;
}, {});
const matched = top100.filter((r) => r.phone || r.email).length;

console.log(
  JSON.stringify(
    {
      ok: true,
      total: top100.length,
      withContact: matched,
      tiers: tierCounts,
      page1: f1,
      page2: f2,
      first5: top100.slice(0, 5).map((r) => r.name),
    },
    null,
    2,
  ),
);
