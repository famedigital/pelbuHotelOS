import { defineConfig, devices } from "@playwright/test";

/**
 * Critical-path desk smoke. Skips cleanly when desk credentials missing
 * so CI without secrets does not false-fail.
 *
 * Env (optional — helpers fall back to DESK_PIN / NEXT_PUBLIC_SITE_URL):
 *   PLAYWRIGHT_BASE_URL
 *   PLAYWRIGHT_DESK_PIN | DESK_PIN
 *   PLAYWRIGHT_DESK_EMAIL + PLAYWRIGHT_DESK_PASSWORD
 *   PLAYWRIGHT_MONEY_CYCLE=1  — enable mutation walk
 *
 * No screenshot artifacts written by default (layout uses overflow asserts).
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "off",
    video: "off",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
