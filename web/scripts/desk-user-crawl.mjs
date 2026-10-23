/**
 * Read-only desk crawl. Opens every static /erp page, then a sample of
 * real record links found on those pages. Does not click Save, Check in,
 * Check out, Pay, or Delete.
 *
 *   node --env-file=.env.local scripts/desk-user-crawl.mjs
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "src", "app");
const out = join(root, "scripts", "_tmp-desk-crawl-report.json");
const pin = process.env.DESK_PIN?.trim() || process.env.PLAYWRIGHT_DESK_PIN?.trim();
const base = (process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

if (!pin) {
  console.error("Set DESK_PIN or PLAYWRIGHT_DESK_PIN");
  process.exit(2);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

function toRoute(file) {
  const rel = relative(appDir, dirname(file)).replace(/\\/g, "/");
  const parts = rel
    .split("/")
    .filter((part) => part && !part.startsWith("("));
  if (parts.some((part) => part.startsWith("["))) return null;
  const path = "/" + parts.join("/");
  return path === "/" ? null : path;
}

const erpRoutes = [...new Set(walk(appDir).map(toRoute).filter((path) => path?.startsWith("/erp")))].sort();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies([
  {
    name: "hotelos_desk_session",
    value: `ok:${pin}`,
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  },
]);
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();
  if (/favicon|webpack-hmr|Download the React DevTools/i.test(text)) return;
  consoleErrors.push(text.slice(0, 300));
});
page.on("pageerror", (err) => {
  consoleErrors.push(String(err).slice(0, 300));
});

const findings = [];

async function visit(path, source) {
  const startErrors = consoleErrors.length;
  const failed = [];
  const onResponse = (res) => {
    const url = res.url();
    if (!url.startsWith(base)) return;
    if (url.includes("/_next/") || url.includes("webpack-hmr")) return;
    const status = res.status();
    if (status >= 500) failed.push({ status, url: url.slice(base.length).slice(0, 180) });
  };
  page.on("response", onResponse);
  let status = 0;
  let url = "";
  let crash = false;
  let login = false;
  let title = "";
  try {
    const res = await page.goto(base + path, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    status = res?.status() ?? 0;
    await page.waitForTimeout(400);
    url = page.url();
    const text = await page.locator("body").innerText({ timeout: 8_000 }).catch(() => "");
    crash = /Application error|a client-side exception/i.test(text);
    login = /\/erp\/login/.test(url) && path !== "/erp/login";
    title = (await page.title().catch(() => "")).slice(0, 80);
    if (status >= 500 || crash || login || failed.length) {
      findings.push({
        path,
        source,
        status,
        url: url.replace(base, ""),
        title,
        crash,
        login,
        failed: failed.slice(0, 5),
        console: consoleErrors.slice(startErrors, startErrors + 4),
      });
    }
  } catch (err) {
    findings.push({
      path,
      source,
      status,
      error: String(err).slice(0, 240),
      console: consoleErrors.slice(startErrors, startErrors + 4),
    });
  } finally {
    page.off("response", onResponse);
    writeFileSync(
      out,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          property: property.name,
          staticRoutes: erpRoutes.length,
          problemCount: findings.length,
          findings,
        },
        null,
        2,
      ),
    );
  }
}

const property = { name: "" };
await visit("/erp", "home");
property.name = await page
  .locator("#property_id option:checked")
  .innerText()
  .catch(() => "");

for (const path of erpRoutes) {
  if (path === "/erp") continue;
  await visit(path, "static");
  process.stdout.write(".");
}
process.stdout.write("\n");

const discovered = new Set();
for (const path of ["/erp/reservations", "/erp/folios", "/erp/invoices", "/erp/in-house", "/erp/guests"]) {
  await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") || ""))
    .catch(() => []);
  for (const href of hrefs) {
    const clean = href.split("?")[0];
    if (!clean.startsWith("/erp/")) continue;
    if (!/\[[^\]]+\]/.test(clean) && /\/[0-9a-f-]{8,}|\/[^/]+\/[^/]+/.test(clean)) {
      if (!erpRoutes.includes(clean)) discovered.add(clean);
    }
  }
}
const recordLinks = [...discovered].slice(0, 25);
for (const path of recordLinks) {
  await visit(path, "record");
  process.stdout.write("r");
}
process.stdout.write("\n");

const report = {
  at: new Date().toISOString(),
  property: property.name,
  staticRoutes: erpRoutes.length,
  recordLinks: recordLinks.length,
  problemCount: findings.length,
  findings,
};
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      property: report.property,
      staticRoutes: report.staticRoutes,
      recordLinks: report.recordLinks,
      problemCount: report.problemCount,
      problems: findings.map((row) => ({
        path: row.path,
        source: row.source,
        status: row.status,
        crash: row.crash || false,
        login: row.login || false,
        error: row.error || "",
        failed: (row.failed || []).map((item) => item.status + " " + item.url),
        console: row.console || [],
      })),
    },
    null,
    2,
  ),
);
await browser.close();
