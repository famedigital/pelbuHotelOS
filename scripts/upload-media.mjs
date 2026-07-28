/**
 * Build PWA/favicon icons and upload hotel media to Cloudinary.
 * Loads credentials from web/.env.local — never prints secrets.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sharp = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "node_modules", "sharp"));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB = path.join(ROOT, "web");
const REF = path.join(ROOT, "ref");
const BRAND = path.join(ROOT, "design", "brand");
const ICONS = path.join(WEB, "public", "icons");
const GEN = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-GitHub-pelbusuites",
  "assets",
);

function loadEnv() {
  const envPath = path.join(WEB, ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim();
  }
  return env;
}

function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
}

async function uploadFile(env, filePath, publicId, folderTags = "pelbu") {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = {
    public_id: publicId,
    overwrite: "true",
    tags: folderTags,
    timestamp,
  };
  const signature = signParams(params, apiSecret);
  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  form.append("file", new Blob([buf]), path.basename(filePath));
  form.append("api_key", apiKey);
  form.append("signature", signature);
  for (const [k, v] of Object.entries(params)) form.append(k, v);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${publicId}: ${json.error?.message || res.statusText}`);
  }
  return json.public_id;
}

async function uploadRemote(env, fileUrl, publicId, folderTags = "pelbu") {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = {
    public_id: publicId,
    overwrite: "true",
    tags: folderTags,
    timestamp,
  };
  const signature = signParams(params, apiSecret);
  const form = new FormData();
  form.append("file", fileUrl);
  form.append("api_key", apiKey);
  form.append("signature", signature);
  for (const [k, v] of Object.entries(params)) form.append(k, v);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${publicId}: ${json.error?.message || res.statusText}`);
  }
  return json.public_id;
}

async function buildIcons() {
  fs.mkdirSync(ICONS, { recursive: true });
  const src = fs.existsSync(path.join(BRAND, "pelbu-logo-icon-3d.png"))
    ? path.join(BRAND, "pelbu-logo-icon-3d.png")
    : path.join(ROOT, "pelbu-logo-icon.png");

  const sizes = [
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "favicon-32.png", size: 32 },
    { name: "favicon-16.png", size: 16 },
  ];

  for (const { name, size } of sizes) {
    const out = path.join(ICONS, name);
    await sharp(src)
      .resize(size, size, {
        fit: "contain",
        background: { r: 28, g: 22, b: 18, alpha: 1 },
      })
      .png()
      .toFile(out);
    console.log("icon", name);
  }

  await sharp(src)
    .resize(32, 32, {
      fit: "contain",
      background: { r: 28, g: 22, b: 18, alpha: 1 },
    })
    .png()
    .toFile(path.join(WEB, "public", "favicon.ico"));
  console.log("icon favicon.ico");
}

async function main() {
  const env = loadEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error("Missing Cloudinary env in web/.env.local");
  }

  await buildIcons();

  const brandUploads = [
    [path.join(BRAND, "pelbu-logo-icon-3d.png"), "pelbu/brand/logo-primary"],
    [path.join(BRAND, "pelbu-logo-icon-flat.png"), "pelbu/brand/logo-flat"],
    [path.join(ROOT, "pelbu-logo-primary.png"), "pelbu/brand/logo-wordmark"],
  ];
  for (const [file, id] of brandUploads) {
    if (!fs.existsSync(file)) continue;
    console.log("uploaded", await uploadFile(env, file, id, "pelbu,brand"));
  }

  const refMap = [
    ["ext1.jpg", "pelbu/bar/evening-pour"],
    ["ext5.jpg", "pelbu/restaurant/dining-room"],
    ["mmt-ext.jpg", "pelbu/rooms/suite-view"],
    ["linkedin-ext.jpg", "pelbu/rooms/deluxe-suite"],
    ["ta3.jpg", "pelbu/spa/jacuzzi"],
    ["ta4.jpg", "pelbu/rooms/superior-living"],
    ["ext3.jpg", "pelbu/gallery/ext3"],
    ["ext4.jpg", "pelbu/gallery/ext4"],
    ["ext6.jpg", "pelbu/gallery/ext6"],
    ["ext7.jpg", "pelbu/gallery/ext7"],
    ["ext8.jpg", "pelbu/gallery/ext8"],
    ["ext9.png", "pelbu/gallery/ext9"],
    ["ext10.jpg", "pelbu/gallery/ext10"],
    ["ext11.jpg", "pelbu/gallery/ext11"],
    ["ta2.jpg", "pelbu/gallery/ta2"],
    ["ta5.jpg", "pelbu/gallery/ta5"],
    ["ta6.jpg", "pelbu/gallery/ta6"],
  ];
  for (const [file, id] of refMap) {
    const full = path.join(REF, file);
    if (!fs.existsSync(full)) continue;
    console.log("uploaded", await uploadFile(env, full, id, "pelbu,ref"));
  }

  const remote = [
    [
      "https://www.sevensuitesthimphu.com/wp-content/uploads/2023/11/luxurious-suites.jpg",
      "pelbu/rooms/deluxe",
    ],
    [
      "https://www.sevensuitesthimphu.com/wp-content/uploads/2023/11/deluxe-double.jpg",
      "pelbu/rooms/superior",
    ],
    [
      "https://www.sevensuitesthimphu.com/wp-content/uploads/2023/11/deluxe-single.jpg",
      "pelbu/rooms/twin",
    ],
    [
      "https://www.sevensuitesthimphu.com/wp-content/uploads/2023/11/suites.jpg",
      "pelbu/rooms/suite-alt",
    ],
    [
      "https://www.sevensuitesthimphu.com/wp-content/uploads/2023/05/IMG_6149-1536x1024.jpg",
      "pelbu/spa/steam",
    ],
    [
      "https://www.sevensuitesthimphu.com/wp-content/uploads/2023/11/DSC08154-1536x1024.jpg",
      "pelbu/hotel/exterior",
    ],
    [
      "https://www.sevensuitesthimphu.com/wp-content/uploads/2023/04/IMg_22-1536x1024.jpg",
      "pelbu/cafe/morning-pastry",
    ],
    [
      "https://www.sevensuitesthimphu.com/wp-content/uploads/2023/05/IMG_6135-1536x1024.jpg",
      "pelbu/restaurant/signature-plate",
    ],
  ];
  for (const [url, id] of remote) {
    console.log("uploaded", await uploadRemote(env, url, id, "pelbu,scraped"));
  }

  // Generated dish images if present
  if (fs.existsSync(GEN)) {
    const dishFiles = fs.readdirSync(GEN).filter((f) => /\.(jpe?g|png)$/i.test(f));
    for (const file of dishFiles) {
      const slug = file.replace(/\.(jpe?g|png)$/i, "");
      const id = `pelbu/menu/${slug}`;
      console.log(
        "uploaded",
        await uploadFile(env, path.join(GEN, file), id, "pelbu,menu"),
      );
    }
  }

  console.log("DONE");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
