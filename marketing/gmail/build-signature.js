/**
 * Thin Gmail signature: real Pelbu logo + 3 rooms + cafe + steam/spa + restaurant
 * + website, phone, email. Run from repo: node marketing/gmail/build-signature.js
 */
const sharp = require("c:/GitHub/pelbusuites/web/node_modules/sharp");
const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT_DIR = path.join("c:/GitHub/pelbusuites/marketing/gmail");
const LOGO = path.join("c:/GitHub/pelbusuites/web/public/brand/logo-mark.png");
const CLOUD = "hkkchsfy";

// One row only — curated public ids (Mailchimp + room heroes)
const PHOTOS = [
  { id: "pelbu/rooms/suite-alt", label: "Room" },
  { id: "pelbu/rooms/twin", label: "Room" },
  { id: "pelbu/rooms/suite-view", label: "Room" },
  { id: "pelbu/cafe/morning-pastry", label: "Cafe" },
  { id: "pelbu/marketing/agent-email-steam", label: "Steam & Spa" },
  { id: "pelbu/restaurant/dining-room", label: "Restaurant" },
];

// Thin strip — Gmail-friendly width
const W = 720;
const H = 78;
const PAD = 8;
const LOGO_H = 60;
const PHOTO_H = 60;
const PHOTO_W = 68;
const GAP = 4;

function cloudUrl(publicId) {
  return `https://res.cloudinary.com/${CLOUD}/image/upload/w_320,h_240,c_fill,g_auto,f_jpg,q_auto:best,e_sharpen:40/${publicId}`;
}

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchBuf(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`${url} → ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function roundPhoto(buf, w, h) {
  const crop = await sharp(buf)
    .resize(w, h, { fit: "cover", position: "attention" })
    .jpeg({ quality: 92 })
    .toBuffer();
  return sharp(crop)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="5" ry="5" fill="white"/></svg>`,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const logoBuf = await sharp(LOGO)
    .resize({
      height: LOGO_H,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();

  const photoBufs = [];
  for (const p of PHOTOS) {
    try {
      const raw = await fetchBuf(cloudUrl(p.id));
      photoBufs.push(await roundPhoto(raw, PHOTO_W, PHOTO_H));
      console.log("ok", p.label, p.id);
    } catch (e) {
      console.warn("fallback blank", p.id, e.message);
      photoBufs.push(
        await sharp({
          create: {
            width: PHOTO_W,
            height: PHOTO_H,
            channels: 3,
            background: { r: 232, g: 213, b: 184 },
          },
        })
          .png()
          .toBuffer(),
      );
    }
  }

  let x = PAD + 4;
  const composites = [];

  composites.push({
    input: logoBuf,
    left: Math.round(x),
    top: Math.round((H - (logoMeta.height || LOGO_H)) / 2),
  });
  x += (logoMeta.width || LOGO_H) + 10;

  const textW = 178;
  const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${textW}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="20" font-family="Georgia, 'Times New Roman', serif" font-size="16" font-weight="700" fill="#1a0f0a">Pelbu Suites</text>
  <text x="0" y="34" font-family="Arial, Helvetica, sans-serif" font-size="8.5" font-weight="600" letter-spacing="1.1" fill="#c45c26">OLAKHA · THIMPHU · BHUTAN</text>
  <text x="0" y="50" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#3d2a22">+975 1619 3410</text>
  <text x="0" y="64" font-family="Arial, Helvetica, sans-serif" font-size="10.5" fill="#3d2a22">pelbusuites@gmail.com</text>
  <text x="0" y="78" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#0f6e63">www.pelbusuites.bt</text>
</svg>`);

  composites.push({ input: textSvg, left: Math.round(x), top: -2 });
  x += textW + 8;

  const divider = Buffer.from(
    `<svg width="2" height="${PHOTO_H}"><rect width="1" height="${PHOTO_H}" fill="#e0c9a8"/></svg>`,
  );
  composites.push({
    input: divider,
    left: Math.round(x),
    top: Math.round((H - PHOTO_H) / 2),
  });
  x += 8;

  for (const pb of photoBufs) {
    composites.push({
      input: pb,
      left: Math.round(x),
      top: Math.round((H - PHOTO_H) / 2),
    });
    // slim gold bottom edge under each thumb
    x += PHOTO_W + GAP;
  }

  const accent = Buffer.from(
    `<svg width="3" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c45c26"/><stop offset="50%" stop-color="#e8a838"/><stop offset="100%" stop-color="#2a9d8f"/></linearGradient></defs><rect width="3" height="${H}" fill="url(#g)"/></svg>`,
  );

  const outPng = path.join(OUT_DIR, "pelbu-gmail-signature.png");
  const outJpg = path.join(OUT_DIR, "pelbu-gmail-signature.jpg");

  await sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 255, g: 250, b: 243 },
    },
  })
    .composite([{ input: accent, left: 0, top: 0 }, ...composites])
    .png({ compressionLevel: 9 })
    .toFile(outPng);

  await sharp(outPng)
    .jpeg({ quality: 90, progressive: true })
    .toFile(outJpg);

  // 2x for retina emails
  await sharp(outPng)
    .resize(W * 2, H * 2, { kernel: "lanczos3" })
    .png()
    .toFile(path.join(OUT_DIR, "pelbu-gmail-signature@2x.png"));

  const st = fs.statSync(outPng);
  console.log("Wrote", outPng, st.size, "bytes", `${W}x${H}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
