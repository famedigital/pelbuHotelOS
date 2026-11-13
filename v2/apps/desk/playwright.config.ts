import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

/**
 * OPERATIONS-FLOW desk journeys (FO FIT §5.2).
 * Expects API :4200 + Vite desk :5174 (reuseExistingServer).
 * Does not flip V2_DESK_CUTOVER.
 *
 * API webServer loads apps/api/.env then .env.local so StayHub money paths hit
 * Postgres (without it, createReservation returns DATABASE_REQUIRED).
 * Requires ALLOW_E2E_DEMO_AUTH=1 + E2E_DEMO_PROPERTY_ID (DEMO / seed archive only).
 */
const baseURL =
  process.env.VITE_DESK_URL?.replace(/\/$/, "") ||
  process.env.V2_DESK_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:5174";

const configDir = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(filePath: string): Record<string, string> {
  try {
    const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

function loadApiEnvLocal(): Record<string, string> {
  const apiDir = resolve(configDir, "../api");
  return {
    ...parseEnvFile(resolve(apiDir, ".env")),
    ...parseEnvFile(resolve(apiDir, ".env.local")),
  };
}

const apiEnvLocal = loadApiEnvLocal();

/* Expose DEMO property ids to the Playwright test process (unlock helper). */
for (const key of [
  "E2E_DEMO_PROPERTY_ID",
  "E2E_DEMO_PROPERTY_SLUG",
  "E2E_DEMO_PROPERTY_NAME",
  "ALLOW_E2E_DEMO_AUTH",
] as const) {
  if (apiEnvLocal[key] && process.env[key] === undefined) {
    process.env[key] = apiEnvLocal[key];
  }
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "off",
    video: "off",
    ...devices["Desktop Chrome"],
    // Windows WDAC often blocks ms-playwright headless_shell (spawn UNKNOWN).
    // Set PLAYWRIGHT_CHANNEL=chrome to use installed Google Chrome.
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        /* Droplet SSH tunnel on :4200 — set PLAYWRIGHT_REUSE_API=1 to skip local API. */
        ...(process.env.PLAYWRIGHT_REUSE_API === "1"
          ? []
          : [
              {
                command: "pnpm --filter @hos-v2/api dev",
                cwd: "../..",
                url: process.env.VITE_API_URL || "http://127.0.0.1:4200/health",
                reuseExistingServer: true,
                timeout: 180_000,
                env: {
                  ...process.env,
                  ...apiEnvLocal,
                  ALLOW_E2E_DEMO_AUTH: "1",
                  PORT: "4200",
                },
              },
            ]),
        {
          command: "pnpm --filter @hos-v2/desk dev",
          cwd: "../..",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            ...process.env,
            VITE_ALLOW_LOCAL_DEMO_AUTH: "1",
          },
        },
      ],
});
