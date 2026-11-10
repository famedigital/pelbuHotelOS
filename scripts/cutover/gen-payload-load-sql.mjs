import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const doc = fs.readFileSync(path.join(dir, "_pelbu-full-payload.json"), "utf8");
const tag = "pelbujson9f3a";
if (doc.includes(tag)) throw new Error("tag collision");
const sql = `CREATE UNLOGGED TABLE IF NOT EXISTS v2._sync_payload (doc jsonb);
TRUNCATE v2._sync_payload;
INSERT INTO v2._sync_payload(doc) VALUES ($${tag}$${doc}$${tag}$::jsonb);
`;
const out = path.join(dir, "_pelbu-load-payload.sql");
fs.writeFileSync(out, sql);
console.log(JSON.stringify({ out, mb: +(Buffer.byteLength(sql) / 1024 / 1024).toFixed(2) }));
