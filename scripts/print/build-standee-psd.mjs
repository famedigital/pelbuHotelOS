/**
 * Convert café geometric standees HTML → layered PSD (large-format).
 *
 * Source: marketing/print/menu-standee-sketch-35x72.html
 * Output: marketing/print/standee-psd/
 *
 * Usage (from repo root):
 *   node scripts/print/build-standee-psd.mjs
 *
 * Renders at ~150 dpi CSS inches (deviceScaleFactor 1.5 × 96).
 * Large-format friendly; designer can scale in Photoshop.
 */
import "ag-psd/initialize-canvas.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { writePsdBuffer } from "ag-psd";
import { createCanvas, loadImage } from "canvas";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const htmlPath = path.join(root, "marketing/print/menu-standee-sketch-35x72.html");
const outDir = path.join(root, "marketing/print/standee-psd");

const require = createRequire(path.join(root, "web/package.json"));
const { chromium } = require("playwright");

/** Prefer env override (CI / sandbox installs). */
if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
  // playwright reads this env at launch
}

/** CSS inch ≈ 96px; 1.5× ≈ 144 dpi — solid for roll-up / standee masters */
const DEVICE_SCALE = 1.5;

const PREP_CSS = `
  .print-bar, .side-tag, .stage > p { display: none !important; }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  .stage { padding: 0 !important; gap: 0 !important; }
  .preview-frame {
    width: 35.5in !important;
    height: 72in !important;
    box-shadow: none !important;
    margin: 0 !important;
  }
  .preview-scale {
    transform: none !important;
    width: 35.5in !important;
    height: 72in !important;
  }
  .sheet { width: 35.5in !important; height: 72in !important; }
`;

async function waitForImages(page) {
  await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      }),
    );
  });
  await page.waitForTimeout(800);
}

async function sheetMetrics(page, sheetSel) {
  return page.evaluate((sel) => {
    const sheet = document.querySelector(sel);
    const r = sheet.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, sheetSel);
}

async function captureLayer(page, sheetSel, layerSel, fullW, fullH, scale) {
  const data = await page.evaluate(
    ({ sheetSel, layerSel }) => {
      const sheet = document.querySelector(sheetSel);
      const el = sheet.querySelector(layerSel);
      if (!el) return null;
      const sr = sheet.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      return {
        left: er.left - sr.left,
        top: er.top - sr.top,
        width: er.width,
        height: er.height,
      };
    },
    { sheetSel, layerSel },
  );
  if (!data || data.width < 2 || data.height < 2) return null;

  const handle = await page.$(`${sheetSel} ${layerSel}`);
  if (!handle) return null;

  const png = await handle.screenshot({ type: "png", omitBackground: false });
  const left = Math.round(data.left * scale);
  const top = Math.round(data.top * scale);
  const img = await loadImage(png);
  const canvas = createCanvas(fullW, fullH);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, fullW, fullH);
  ctx.drawImage(img, left, top);
  return { canvas, left, top, name: layerSel };
}

async function captureFullSheet(page, sheetSel) {
  const handle = await page.$(sheetSel);
  return handle.screenshot({ type: "png" });
}

function guidesCanvas(width, height, scale) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const baseSafe = Math.round(3 * 96 * scale); // 3 in
  ctx.strokeStyle = "rgba(255, 0, 0, 0.55)";
  ctx.lineWidth = Math.max(2, Math.round(3 * scale));
  ctx.setLineDash([12 * scale, 10 * scale]);
  ctx.strokeRect(2, 2, width - 4, height - 4);
  ctx.fillStyle = "rgba(255, 0, 0, 0.12)";
  ctx.fillRect(0, height - baseSafe, width, baseSafe);
  ctx.strokeStyle = "rgba(0, 120, 255, 0.5)";
  ctx.beginPath();
  ctx.moveTo(0, height - baseSafe);
  ctx.lineTo(width, height - baseSafe);
  ctx.stroke();
  return canvas;
}

async function pngToCanvas(pngBuf, width, height) {
  const img = await loadImage(pngBuf);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

async function exportStandee(page, {
  id,
  sheetSel,
  layers,
  psdName,
}) {
  const exportDir = path.join(outDir, "exports", id);
  fs.mkdirSync(exportDir, { recursive: true });

  const metrics = await sheetMetrics(page, sheetSel);
  const fullW = Math.round(metrics.width * DEVICE_SCALE);
  const fullH = Math.round(metrics.height * DEVICE_SCALE);
  console.log(`  ${id}: ${fullW}×${fullH}px (~${Math.round(DEVICE_SCALE * 96)} dpi CSS)`);

  const compositePng = await captureFullSheet(page, sheetSel);
  fs.writeFileSync(path.join(exportDir, "composite.png"), compositePng);
  await sharp(compositePng).tiff({ compression: "lzw" }).toFile(path.join(exportDir, "composite.tif"));

  const psdChildren = [];

  // Guides on top (hidden by default in PS — still present)
  const guides = guidesCanvas(fullW, fullH, DEVICE_SCALE);
  psdChildren.push({ name: "00_guides", left: 0, top: 0, canvas: guides, hidden: true });

  for (const layer of layers) {
    process.stdout.write(`    layer ${layer.name}… `);
    const captured = await captureLayer(
      page,
      sheetSel,
      layer.sel,
      fullW,
      fullH,
      DEVICE_SCALE,
    );
    if (!captured) {
      console.log("skip");
      continue;
    }
    const layerCanvas = captured.canvas;
    psdChildren.push({
      name: layer.name,
      left: 0,
      top: 0,
      canvas: layerCanvas,
      hidden: false,
    });
    const tiffPath = path.join(exportDir, `${layer.name}.tif`);
    await sharp(layerCanvas.toBuffer("image/png"))
      .tiff({ compression: "lzw" })
      .toFile(tiffPath);
    console.log("ok");
  }

  // Full flat as bottom reference (designer can hide)
  const flat = await pngToCanvas(compositePng, fullW, fullH);
  psdChildren.push({
    name: "01_composite_flat",
    left: 0,
    top: 0,
    canvas: flat,
    hidden: false,
  });

  // PSD children: top of stack first in Photoshop UI when reversed
  const psd = {
    width: fullW,
    height: fullH,
    children: [...psdChildren].reverse(),
  };

  const psdPath = path.join(outDir, psdName);
  fs.writeFileSync(psdPath, writePsdBuffer(psd));
  console.log(`  Wrote ${psdPath}`);
}

async function main() {
  if (!fs.existsSync(htmlPath)) {
    console.error("Missing", htmlPath);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    deviceScaleFactor: DEVICE_SCALE,
    viewport: { width: 1280, height: 900 },
  });

  const url = pathToFileURL(htmlPath).href;
  console.log("Opening", url);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.addStyleTag({ content: PREP_CSS });
  await waitForImages(page);

  // Expand viewport to full sheet so layout isn't clipped
  await page.setViewportSize({
    width: Math.ceil(35.5 * 96) + 40,
    height: Math.ceil(72 * 96) + 40,
  });
  await page.waitForTimeout(500);
  await waitForImages(page);

  await exportStandee(page, {
    id: "standee-1-barista",
    sheetSel: "article.sheet.s1",
    psdName: "standee-1-barista-cafe.psd",
    layers: [
      { name: "02_brand_block", sel: ".brand-block" },
      { name: "03_radial_mosaic", sel: ".radial-wrap" },
      { name: "04_cta_block", sel: ".cta-block" },
      { name: "05_contacts", sel: ".contacts" },
      { name: "06_logo", sel: ".brand-block img" },
      { name: "07_qr", sel: ".cta-block .qr-wrap" },
      { name: "08_seg_01_korean_bbq", sel: ".radial .seg:nth-child(1)" },
      { name: "08_seg_02_fried_chicken", sel: ".radial .seg:nth-child(2)" },
      { name: "08_seg_03_rolls", sel: ".radial .seg:nth-child(3)" },
      { name: "08_seg_04_fries", sel: ".radial .seg:nth-child(4)" },
      { name: "08_seg_05_lollipop", sel: ".radial .seg:nth-child(5)" },
      { name: "08_seg_06_club", sel: ".radial .seg:nth-child(6)" },
    ],
  });

  await exportStandee(page, {
    id: "standee-2-cafe-resto",
    sheetSel: "article.sheet.s2",
    psdName: "standee-2-cafe-restaurant.psd",
    layers: [
      { name: "02_s2_top", sel: ".s2-top" },
      { name: "03_s2_mid", sel: ".s2-mid" },
      { name: "04_s2_angled", sel: ".s2-angled" },
      { name: "05_s2_resto_label", sel: ".s2-resto-label" },
      { name: "06_s2_resto", sel: ".s2-resto" },
      { name: "07_s2_footer", sel: ".s2-footer" },
      { name: "08_logo", sel: ".s2-top .brand-mini img" },
      { name: "09_feature_circle", sel: ".feature-circle" },
      { name: "10_qr", sel: ".s2-footer .qr-wrap" },
    ],
  });

  await browser.close();
  console.log("Done →", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
