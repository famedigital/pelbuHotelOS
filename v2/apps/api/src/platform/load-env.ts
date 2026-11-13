/**
 * Load `apps/api/.env` into process.env when present (local Playwright / dev).
 * Does not override keys already set in the environment.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadApiEnvFile(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(here, "../../.env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
