const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const root = path.resolve(__dirname, "../../..");
const envPath = path.join(root, "web", ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      let k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return [k, v];
    }),
);

const cloud = env.CLOUDINARY_CLOUD_NAME || env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const key = env.CLOUDINARY_API_KEY;
const secret = env.CLOUDINARY_API_SECRET;
if (!cloud || !key || !secret) {
  console.error("missing Cloudinary credentials");
  process.exit(1);
}

const dir = path.join(root, "marketing", "print", "menu-food");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));

function sign(params) {
  const toSign =
    Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&") + secret;
  return crypto.createHash("sha1").update(toSign).digest("hex");
}

function uploadOne(file) {
  return new Promise((resolve, reject) => {
    const publicId = `pelbu/menu/${path.basename(file, ".png")}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      invalidate: "true",
      overwrite: "true",
      public_id: publicId,
      timestamp: String(timestamp),
    };
    const signature = sign(params);
    const boundary =
      "----Pelbu" + Date.now() + Math.random().toString(16).slice(2);
    const fileBuf = fs.readFileSync(path.join(dir, file));
    const parts = [];
    const fields = { ...params, signature, api_key: key };
    for (const [k, v] of Object.entries(fields)) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
        ),
      );
    }
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file}"\r\nContent-Type: image/png\r\n\r\n`,
      ),
    );
    parts.push(fileBuf);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const req = https.request(
      {
        hostname: "api.cloudinary.com",
        path: `/v1_1/${cloud}/image/upload`,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const j = JSON.parse(data);
            resolve(j.public_id);
          } else {
            reject(new Error(`${file} HTTP ${res.statusCode} ${data.slice(0, 240)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  let ok = 0;
  let fail = 0;
  for (const f of files) {
    try {
      const id = await uploadOne(f);
      ok += 1;
      console.log("OK", id);
    } catch (e) {
      fail += 1;
      console.error("FAIL", e.message);
    }
  }
  console.log(`DONE ok=${ok} fail=${fail} total=${files.length}`);
  if (fail > 0) process.exit(1);
})();
