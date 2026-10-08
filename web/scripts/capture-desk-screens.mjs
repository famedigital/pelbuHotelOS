import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = "http://localhost:3456";
const pin = process.env.DESK_PIN?.trim();
if (!pin) {
  console.error("DESK_PIN missing");
  process.exit(1);
}

const out = path.resolve("public/marketing/screens");
await mkdir(out, { recursive: true });

const routes = [
  ["desk", "/erp"],
  ["today", "/erp/today"],
  ["arrivals", "/erp/arrivals"],
  ["pos", "/erp/pos"],
  ["night-audit", "/erp/night-audit"],
];

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
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

for (const [name, route] of routes) {
  const res = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({
    content: "nextjs-portal,[data-nextjs-toast],[data-next-badge]{display:none!important}",
  });
  const height = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("main *")];
    let max = 0;
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 16) continue;
      if (rect.bottom > max) max = rect.bottom;
    }
    return Math.min(900, Math.max(640, Math.ceil(max + 32)));
  });
  const file = path.join(out, `${name}.png`);
  await page.screenshot({
    path: file,
    clip: { x: 0, y: 0, width: 1440, height },
  });
  console.log(name, res?.status() ?? 0, height, page.url());
}

await browser.close();
