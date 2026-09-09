/**
 * Build layered PSD + per-layer TIFF exports for Pelbu sticker pack.
 * Usage: node scripts/print/build-sticker-psd.mjs
 *
 * Physical trims (designer can still move layers in PSD):
 *   Folder 45 mm H: 70 × 45 mm
 *   Folder 30 mm H: 60 × 30 mm
 *   Tissue:         65 × 65 mm
 *   Plyboard:       120 × 50 mm (rectangle, 5 cm height)
 *
 * 600 dpi — high-res masters for print-house play / resize.
 */
import "ag-psd/initialize-canvas.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePsdBuffer } from "ag-psd";
import { createCanvas, loadImage } from "canvas";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const stickersDir = path.join(root, "marketing/print/stickers");
const assetsDir = path.join(stickersDir, "assets");

const DPI = 600;
const BLEED_MM = 3;

function mm(n) {
  return Math.round((n * DPI) / 25.4);
}

function artboardSize(trimW, trimH) {
  return {
    width: mm(trimW + BLEED_MM * 2),
    height: mm(trimH + BLEED_MM * 2),
    bleed: mm(BLEED_MM),
    trimW: mm(trimW),
    trimH: mm(trimH),
  };
}

async function renderTextPng(text, {
  width,
  height,
  fontSize,
  fontFamily,
  fontWeight = 600,
  fill = "#ffffff",
  letterSpacing = 0,
  textAnchor = "start",
  lines = null,
}) {
  const x = textAnchor === "middle" ? width / 2 : 0;
  const rows = lines ?? [text];
  const tspans = rows
    .map((line, i) => {
      const y = fontSize + i * fontSize * 1.05;
      return `<tspan x="${x}" y="${y}">${line}</tspan>`;
    })
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text fill="${fill}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacing}px" text-anchor="${textAnchor}">${tspans}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderRulePng(width, height, color, gradient = false) {
  const fill = gradient
    ? `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${color}" stop-opacity="0"/><stop offset="0.5" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/>`
    : `<rect width="${width}" height="${height}" fill="${color}"/>`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${fill}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function bufferToCanvas(buffer, targetW, targetH) {
  const canvas = createCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d");
  const img = await loadImage(buffer);
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas;
}

async function solidCanvas(width, height, color, alpha = 1) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  return canvas;
}

async function guidesCanvas(board) {
  const canvas = createCanvas(board.width, board.height);
  const ctx = canvas.getContext("2d");
  const b = board.bleed;
  const dash = Math.max(4, Math.round(DPI / 75));
  ctx.strokeStyle = "rgba(255, 0, 0, 0.55)";
  ctx.lineWidth = Math.max(1, Math.round(DPI / 150));
  ctx.setLineDash([dash, dash]);
  ctx.strokeRect(b + 1, b + 1, board.trimW - 2, board.trimH - 2);
  ctx.strokeStyle = "rgba(0, 120, 255, 0.45)";
  ctx.strokeRect(1, 1, board.width - 2, board.height - 2);
  return canvas;
}

async function resizedLogo(logoPath, sizePx) {
  return sharp(logoPath).resize(sizePx, sizePx, { fit: "inside" }).png().toBuffer();
}

async function resizedQr(sizePx) {
  const qrPath = path.join(assetsDir, "qr-whatsapp-97516193410.png");
  return sharp(qrPath).resize(sizePx, sizePx, { fit: "fill" }).png().toBuffer();
}

async function qrWithPad(sizePx, padPx, bg = "#ffffff") {
  const inner = await resizedQr(sizePx - padPx * 2);
  return sharp({
    create: {
      width: sizePx,
      height: sizePx,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: inner, left: padPx, top: padPx }])
    .png()
    .toBuffer();
}

async function writeLayerTiff(buffer, outPath, boardW, boardH, left, top) {
  const full = await sharp({
    create: {
      width: boardW,
      height: boardH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: buffer, left, top }])
    .tiff({ compression: "lzw" })
    .toBuffer();
  fs.writeFileSync(outPath, full);
}

/** Folder black — 70 × 45 mm (4.5 cm height) — max logo / QR / type */
async function buildFolder45() {
  const board = artboardSize(70, 45);
  const b = board.bleed;
  const padX = mm(1.5);
  const padY = mm(1.5);
  const logoSize = mm(20);
  const qrSize = mm(20);

  const logoBuf = await resizedLogo(path.join(assetsDir, "logo-mark-white.png"), logoSize);
  const wordmarkBuf = await renderTextPng("Pelbu Suites", {
    width: mm(46),
    height: mm(9),
    fontSize: mm(7.2),
    fontFamily: "Georgia, serif",
    fontWeight: 700,
    fill: "#ffffff",
  });
  const websiteBuf = await renderTextPng("www.pelbusuites.bt", {
    width: mm(46),
    height: mm(5),
    fontSize: mm(3.4),
    fontFamily: "Arial, sans-serif",
    fontWeight: 700,
    fill: "#ffffff",
    letterSpacing: 0.5,
  });
  const qrBuf = await qrWithPad(qrSize, mm(0.6));
  const captionBuf = await renderTextPng("Scan · WhatsApp us", {
    width: mm(44),
    height: mm(5),
    fontSize: mm(3.2),
    fontFamily: "Arial, sans-serif",
    fontWeight: 700,
    fill: "#ffffff",
  });

  const logoLeft = b + padX;
  const logoTop = b + padY;
  const textLeft = logoLeft + logoSize + mm(1.5);
  const wordTop = b + padY + mm(1);
  const webTop = wordTop + mm(8);
  const qrLeft = b + padX;
  const qrTop = b + board.trimH - padY - qrSize;
  const capLeft = qrLeft + qrSize + mm(1.5);
  const capTop = qrTop + mm(6);

  return {
    id: "folder-45",
    board,
    layers: [
      { name: "01_background", left: 0, top: 0, canvas: await solidCanvas(board.width, board.height, "#000000") },
      { name: "02_logo_mark", left: logoLeft, top: logoTop, canvas: await bufferToCanvas(logoBuf, logoSize, logoSize) },
      { name: "03_wordmark", left: textLeft, top: wordTop, canvas: await bufferToCanvas(wordmarkBuf, mm(46), mm(9)) },
      { name: "04_website", left: textLeft, top: webTop, canvas: await bufferToCanvas(websiteBuf, mm(46), mm(5)) },
      { name: "05_qr_whatsapp", left: qrLeft, top: qrTop, canvas: await bufferToCanvas(qrBuf, qrSize, qrSize) },
      { name: "06_headline", left: 0, top: 0, hidden: true, canvas: createCanvas(1, 1) },
      { name: "07_subline", left: 0, top: 0, hidden: true, canvas: createCanvas(1, 1) },
      { name: "08_qr_caption", left: capLeft, top: capTop, canvas: await bufferToCanvas(captionBuf, mm(44), mm(5)) },
      { name: "00_guides", left: 0, top: 0, canvas: await guidesCanvas(board) },
    ],
  };
}

/** Folder black — 60 × 30 mm (3 cm height) — fill height with logo + QR */
async function buildFolder30() {
  const board = artboardSize(60, 30);
  const b = board.bleed;
  const padX = mm(1);
  const padY = mm(1);
  // 18+18 leaves ~22 mm for full wordmark without overlap
  const logoSize = mm(18);
  const qrSize = mm(18);

  const logoBuf = await resizedLogo(path.join(assetsDir, "logo-mark-white.png"), logoSize);
  const wordmarkBuf = await renderTextPng("Pelbu Suites", {
    width: mm(21),
    height: mm(12),
    fontSize: mm(4.6),
    fontFamily: "Georgia, serif",
    fontWeight: 700,
    fill: "#ffffff",
    lines: ["Pelbu", "Suites"],
  });
  const websiteBuf = await renderTextPng("pelbusuites.bt", {
    width: mm(21),
    height: mm(3.5),
    fontSize: mm(2.2),
    fontFamily: "Arial, sans-serif",
    fontWeight: 700,
    fill: "#ffffff",
    letterSpacing: 0.1,
  });
  const qrBuf = await qrWithPad(qrSize, mm(0.5));
  const captionBuf = await renderTextPng("WhatsApp", {
    width: mm(21),
    height: mm(3),
    fontSize: mm(2.3),
    fontFamily: "Arial, sans-serif",
    fontWeight: 700,
    fill: "#ffffff",
  });

  const logoLeft = b + padX;
  const logoTop = b + Math.round((board.trimH - logoSize) / 2);
  const textLeft = logoLeft + logoSize + mm(1);
  const wordTop = b + padY + mm(1);
  const webTop = wordTop + mm(11);
  const capTop = webTop + mm(3.8);
  const qrLeft = b + board.trimW - padX - qrSize;
  const qrTop = b + Math.round((board.trimH - qrSize) / 2);

  return {
    id: "folder-30",
    board,
    layers: [
      { name: "01_background", left: 0, top: 0, canvas: await solidCanvas(board.width, board.height, "#000000") },
      { name: "02_logo_mark", left: logoLeft, top: logoTop, canvas: await bufferToCanvas(logoBuf, logoSize, logoSize) },
      { name: "03_wordmark", left: textLeft, top: wordTop, canvas: await bufferToCanvas(wordmarkBuf, mm(21), mm(12)) },
      { name: "04_website", left: textLeft, top: webTop, canvas: await bufferToCanvas(websiteBuf, mm(21), mm(3.5)) },
      { name: "05_qr_whatsapp", left: qrLeft, top: qrTop, canvas: await bufferToCanvas(qrBuf, qrSize, qrSize) },
      { name: "06_headline", left: 0, top: 0, hidden: true, canvas: createCanvas(1, 1) },
      { name: "07_subline", left: 0, top: 0, hidden: true, canvas: createCanvas(1, 1) },
      { name: "08_qr_caption", left: textLeft, top: capTop, canvas: await bufferToCanvas(captionBuf, mm(21), mm(3)) },
      { name: "00_guides", left: 0, top: 0, canvas: await guidesCanvas(board) },
    ],
  };
}

/** Tissue — 65 × 65 mm — big stacked mark */
async function buildTissue() {
  const board = artboardSize(65, 65);
  const b = board.bleed;
  const centerX = (w) => b + Math.round((board.trimW - w) / 2);

  const logoSize = mm(24);
  const qrSize = mm(22);
  let y = b + mm(2.5);

  const logoBuf = await resizedLogo(path.join(assetsDir, "logo-mark-color.png"), logoSize);
  const ruleBuf = await renderRulePng(mm(18), mm(0.4), "#c45c26");
  const wordmarkBuf = await renderTextPng("Pelbu Suites", {
    width: mm(58),
    height: mm(8),
    fontSize: mm(6.5),
    fontFamily: "Georgia, serif",
    fontWeight: 700,
    fill: "#1a0f0a",
    textAnchor: "middle",
  });
  const websiteBuf = await renderTextPng("www.pelbusuites.bt", {
    width: mm(58),
    height: mm(4),
    fontSize: mm(2.8),
    fontFamily: "Arial, sans-serif",
    fontWeight: 700,
    fill: "#3d2a22",
    letterSpacing: 0.5,
    textAnchor: "middle",
  });
  const qrBuf = await resizedQr(qrSize);
  const captionBuf = await renderTextPng("Scan · WhatsApp us", {
    width: mm(58),
    height: mm(4),
    fontSize: mm(2.6),
    fontFamily: "Arial, sans-serif",
    fontWeight: 700,
    fill: "#3d2a22",
    textAnchor: "middle",
  });

  const logoTop = y;
  y += logoSize + mm(0.8);
  const ruleTop = y;
  y += mm(1.2);
  const wordTop = y;
  y += mm(7.2);
  const webTop = y;
  y += mm(3.5);
  const qrTop = y;
  y += qrSize + mm(0.6);
  const capTop = y;

  return {
    id: "tissue",
    board,
    layers: [
      { name: "01_background", left: 0, top: 0, canvas: await solidCanvas(board.width, board.height, "#fffaf3", 0) },
      { name: "02_logo_mark", left: centerX(logoSize), top: logoTop, canvas: await bufferToCanvas(logoBuf, logoSize, logoSize) },
      { name: "03_wordmark", left: centerX(mm(58)), top: wordTop, canvas: await bufferToCanvas(wordmarkBuf, mm(58), mm(8)) },
      { name: "04_website", left: centerX(mm(58)), top: webTop, canvas: await bufferToCanvas(websiteBuf, mm(58), mm(4)) },
      { name: "05_qr_whatsapp", left: centerX(qrSize), top: qrTop, canvas: await bufferToCanvas(qrBuf, qrSize, qrSize) },
      { name: "06_headline", left: 0, top: 0, hidden: true, canvas: createCanvas(1, 1) },
      { name: "07_subline", left: 0, top: 0, hidden: true, canvas: createCanvas(1, 1) },
      { name: "08_qr_caption", left: centerX(mm(58)), top: capTop, canvas: await bufferToCanvas(captionBuf, mm(58), mm(4)) },
      { name: "09_accent_rule", left: centerX(mm(18)), top: ruleTop, canvas: await bufferToCanvas(ruleBuf, mm(18), mm(0.4)) },
      { name: "00_guides", left: 0, top: 0, canvas: await guidesCanvas(board) },
    ],
  };
}

/** Plyboard — 120 × 50 mm — fill 5 cm height with big marks */
async function buildPlyboard() {
  const board = artboardSize(120, 50);
  const b = board.bleed;
  const padX = mm(2);
  const padY = mm(2);
  // 32+32 leaves ~52 mm — stack Save / water for max type size
  const logoSize = mm(32);
  const qrSize = mm(32);

  const headlineBuf = await renderTextPng("Save water", {
    width: mm(50),
    height: mm(20),
    fontSize: mm(9.5),
    fontFamily: "Georgia, serif",
    fontWeight: 700,
    fill: "#c45c26",
    lines: ["Save", "water"],
  });
  const sublineBuf = await renderTextPng("Every drop counts", {
    width: mm(50),
    height: mm(4),
    fontSize: mm(2.6),
    fontFamily: "Arial, sans-serif",
    fontWeight: 600,
    fill: "rgba(255,253,248,0.92)",
    letterSpacing: 0.3,
  });
  const ruleBuf = await renderRulePng(mm(28), mm(0.45), "#c9932e", true);
  const logoBuf = await resizedLogo(path.join(assetsDir, "logo-mark-white.png"), logoSize);
  const wordmarkBuf = await renderTextPng("Pelbu Suites", {
    width: mm(50),
    height: mm(6),
    fontSize: mm(5.2),
    fontFamily: "Georgia, serif",
    fontWeight: 700,
    fill: "#fffdf8",
  });
  const websiteBuf = await renderTextPng("www.pelbusuites.bt", {
    width: mm(50),
    height: mm(3.5),
    fontSize: mm(2.5),
    fontFamily: "Arial, sans-serif",
    fontWeight: 700,
    fill: "#fffdf8",
    letterSpacing: 0.25,
  });
  const qrBuf = await qrWithPad(qrSize, mm(0.7));
  const captionBuf = await renderTextPng("Scan · WhatsApp", {
    width: mm(50),
    height: mm(3),
    fontSize: mm(2.4),
    fontFamily: "Arial, sans-serif",
    fontWeight: 700,
    fill: "#fffdf8",
  });

  const col1Left = b + padX;
  const headTop = b + mm(1);
  const subTop = headTop + mm(19);
  const ruleTop = subTop + mm(4);
  const wordTop = ruleTop + mm(2.5);
  const webTop = wordTop + mm(5.5);
  const capTop = webTop + mm(3.8);

  const logoLeft = b + mm(52);
  const logoTop = b + Math.round((board.trimH - logoSize) / 2);
  const qrLeft = b + board.trimW - padX - qrSize;
  const qrTop = b + Math.round((board.trimH - qrSize) / 2);

  const plyCanvas = createCanvas(board.width, board.height);
  const ctx = plyCanvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, board.width, 0);
  grad.addColorStop(0, "#7d6042");
  grad.addColorStop(1, "#8a6a4a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, board.width, board.height);

  return {
    id: "plyboard",
    board,
    layers: [
      { name: "01_background", left: 0, top: 0, canvas: plyCanvas },
      { name: "02_logo_mark", left: logoLeft, top: logoTop, canvas: await bufferToCanvas(logoBuf, logoSize, logoSize) },
      { name: "03_wordmark", left: col1Left, top: wordTop, canvas: await bufferToCanvas(wordmarkBuf, mm(50), mm(6)) },
      { name: "04_website", left: col1Left, top: webTop, canvas: await bufferToCanvas(websiteBuf, mm(50), mm(3.5)) },
      { name: "05_qr_whatsapp", left: qrLeft, top: qrTop, canvas: await bufferToCanvas(qrBuf, qrSize, qrSize) },
      { name: "06_headline", left: col1Left, top: headTop, canvas: await bufferToCanvas(headlineBuf, mm(50), mm(20)) },
      { name: "07_subline", left: col1Left, top: subTop, canvas: await bufferToCanvas(sublineBuf, mm(50), mm(4)) },
      { name: "08_qr_caption", left: col1Left, top: capTop, canvas: await bufferToCanvas(captionBuf, mm(50), mm(3)) },
      { name: "09_accent_rule", left: col1Left, top: ruleTop, canvas: await bufferToCanvas(ruleBuf, mm(28), mm(0.45)) },
      { name: "00_guides", left: 0, top: 0, canvas: await guidesCanvas(board) },
    ],
  };
}

async function exportVariant(variant, psdName) {
  const exportDir = path.join(stickersDir, "exports", variant.id);
  fs.mkdirSync(exportDir, { recursive: true });

  const psdLayers = variant.layers
    .slice()
    .reverse()
    .map((layer) => ({
      name: layer.name,
      left: layer.left,
      top: layer.top,
      hidden: layer.hidden ?? false,
      canvas: layer.canvas,
    }));

  const psd = {
    width: variant.board.width,
    height: variant.board.height,
    children: psdLayers,
  };

  const psdPath = path.join(stickersDir, psdName);
  fs.writeFileSync(psdPath, writePsdBuffer(psd));
  console.log(`Wrote ${psdPath} (${variant.board.width}×${variant.board.height}px @ ${DPI}dpi)`);

  for (const layer of variant.layers) {
    if (layer.hidden) continue;
    const pngBuf = layer.canvas.toBuffer("image/png");
    const tiffPath = path.join(exportDir, `${layer.name}.tif`);
    await writeLayerTiff(pngBuf, tiffPath, variant.board.width, variant.board.height, layer.left, layer.top);
  }

  const composite = createCanvas(variant.board.width, variant.board.height);
  const ctx = composite.getContext("2d");
  for (const layer of variant.layers.filter((l) => !l.hidden && l.name !== "00_guides")) {
    ctx.drawImage(layer.canvas, layer.left, layer.top);
  }
  const compositePath = path.join(exportDir, "composite.png");
  fs.writeFileSync(compositePath, composite.toBuffer("image/png"));
  await sharp(compositePath).tiff({ compression: "lzw" }).toFile(path.join(exportDir, "composite.tif"));
  console.log(`Exported layers → ${exportDir}`);
}

async function main() {
  if (!fs.existsSync(path.join(assetsDir, "logo-mark-white.png"))) {
    console.error("Missing assets. Run: node scripts/print/prepare-sticker-assets.mjs");
    process.exit(1);
  }

  await exportVariant(await buildFolder45(), "sticker-folder-black-45.psd");
  await exportVariant(await buildFolder30(), "sticker-folder-black-30.psd");
  await exportVariant(await buildTissue(), "sticker-tissue-box.psd");
  await exportVariant(await buildPlyboard(), "sticker-plyboard-save-water.psd");

  // Keep legacy filename as alias of 45 mm folder for older briefs
  const src45 = path.join(stickersDir, "sticker-folder-black-45.psd");
  const legacy = path.join(stickersDir, "sticker-folder-black.psd");
  fs.copyFileSync(src45, legacy);
  console.log(`Also wrote ${legacy} (= 45 mm)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
