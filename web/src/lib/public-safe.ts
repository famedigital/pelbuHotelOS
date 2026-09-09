/** Bound public SSR so a paused/slow Supabase never hangs the guest for 30s+. */
const PUBLIC_LOADER_MS = 3_000;

/**
 * Soft-fail wrapper for public marketing pages.
 * A missing CMS row, timeout, or transient DB blip must not 500 the homepage.
 */
export async function safePublic<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
  timeoutMs = PUBLIC_LOADER_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`public_timeout:${label}`)),
          timeoutMs,
        );
      }),
    ]);
    return result;
  } catch (error) {
    console.error(`[public] ${label}`, error);
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
