import { defineConfig, devices } from "@playwright/test";

/**
 * OPERATIONS-FLOW desk journeys (FO FIT §5.2).
 * Expects API :4200 + Vite desk :5174 (reuseExistingServer).
 * Does not flip V2_DESK_CUTOVER.
 */
const baseURL =
  process.env.V2_DESK_URL?.replace(/\/$/, "") || "http://127.0.0.1:5174";

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
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "pnpm --filter @hos-v2/api dev",
          cwd: "../..",
          url: process.env.VITE_API_URL || "http://127.0.0.1:4200/health",
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: "pnpm --filter @hos-v2/desk dev",
          cwd: "../..",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
