/**
 * Prepare sticker source assets: color logo copy, white knock-out, WhatsApp QR.
 * Usage: node scripts/print/prepare-sticker-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const assetsDir = path.join(root, "marketing/print/stickers/assets");
const logoSrc = path.join(root, "design/brand/pelbu-logo-icon.png");

const WHATSAPP_URL = "https://wa.me/97516193410";

/**
 * Structural white mark: brown/red/gold ink → white; near-white knot
 * ribbon centers → transparent cutouts so frame mullions + interlacing read.
 */
async function createWhiteLogo(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  const ALPHA_MIN = 24;
  // Knot internal white lines are high-luminance; punch them out.
  const HIGH_LUMA_CUTOUT = 210;
  // Baked black canvas behind the mark (not structure ink).
  const LOW_LUMA_CUTOUT = 16;

  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = data[o + 3];
    const d = i * 4;

    if (a < ALPHA_MIN) {
      out[d] = 0;
      out[d + 1] = 0;
      out[d + 2] = 0;
      out[d + 3] = 0;
      continue;
    }

    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    // Near-black outer canvas → transparent
    if (luma <= LOW_LUMA_CUTOUT) {
      out[d] = 0;
      out[d + 1] = 0;
      out[d + 2] = 0;
      out[d + 3] = 0;
      continue;
    }
    // Near-white detail (knot centers) → transparent gap
    if (luma >= HIGH_LUMA_CUTOUT) {
      out[d] = 0;
      out[d + 1] = 0;
      out[d + 2] = 0;
      out[d + 3] = 0;
      continue;
    }

    // Structure ink (frame, band, gold body) → white
    out[d] = 255;
    out[d + 1] = 255;
    out[d + 2] = 255;
    out[d + 3] = a;
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);
}

async function main() {
  fs.mkdirSync(assetsDir, { recursive: true });

  const colorOut = path.join(assetsDir, "logo-mark-color.png");
  fs.copyFileSync(logoSrc, colorOut);
  console.log(`Copied ${colorOut}`);

  const whiteOut = path.join(assetsDir, "logo-mark-white.png");
  await createWhiteLogo(logoSrc, whiteOut);
  console.log(`Wrote ${whiteOut}`);

  const qrOut = path.join(assetsDir, "qr-whatsapp-97516193410.png");
  const qrBuffer = await QRCode.toBuffer(WHATSAPP_URL, {
    type: "png",
    width: 1200,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  fs.writeFileSync(qrOut, qrBuffer);
  console.log(`Wrote ${qrOut} → ${WHATSAPP_URL}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
