export async function register() {
  // Sentry + Turbopack can fail locally with hashed require-in-the-middle.
  // Keep prod/staging instrumentation; skip when DSN unset (typical local).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    await import("../sentry.server.config");
  } catch (err) {
    console.error("[instrumentation] Sentry server config failed to load", err);
  }
}
