import { defineConfig, devices } from "@playwright/test";

/**
 * Critical-path desk smoke. Skips cleanly when PLAYWRIGHT_BASE_URL / credentials
 * are missing so CI without secrets does not false-fail.
 *
 * Env:
 *   PLAYWRIGHT_BASE_URL   e.g. http://127.0.0.1:3000
 *   PLAYWRIGHT_DESK_EMAIL staff Auth email (optional — PIN path if DESK_PIN UI)
 *   PLAYWRIGHT_DESK_PASSWORD
 *   PLAYWRIGHT_DESK_PIN   shared desk PIN fallback when email unset
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") || "";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  use: {
    baseURL: baseURL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
