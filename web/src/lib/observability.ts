/**
 * Capture errors to Sentry when configured; otherwise console.error.
 * Safe to call from server actions and cron routes.
 */
export async function captureServerError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    console.error("[pelbu]", error, context);
    return;
  }
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, { extra: context });
  } catch {
    console.error("[pelbu]", error, context);
  }
}
