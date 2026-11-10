/**
 * Boot guard: v2_app must not read Innora public.bookings.
 * When DATABASE_URL is unset (local docs/dev without DB), skip with warning.
 */
export async function assertNoPublicBookingsAccess(
  query: (sql: string) => Promise<unknown>,
): Promise<void> {
  try {
    await query("select 1 from public.bookings limit 1");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/permission denied|does not exist|relation .* does not exist/i.test(msg)) {
      return;
    }
    throw err;
  }
  throw new Error(
    "REFUSE_START: DB role can read public.bookings — v2_app must have no grants on public (ADR 001)",
  );
}
