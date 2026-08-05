/**
 * Soft-fail wrapper for public marketing pages.
 * A missing CMS row or transient DB blip must not 500 the whole homepage.
 */
export async function safePublic<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[public] ${label}`, error);
    return fallback;
  }
}
