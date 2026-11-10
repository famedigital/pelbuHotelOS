/** Default Bhutan GST rate used when a property override is not loaded. */
export const DEFAULT_GST_RATE = 0.07;

/**
 * Rate actually posted on rooms, menu, and services.
 * The hotel switch wins: off means 0 even when a rate is saved.
 * Service charge is not affected.
 */
export function effectiveGstRate(
  source:
    | { gst_enabled?: boolean | null; gst_rate?: number | null }
    | null
    | undefined,
  fallback = DEFAULT_GST_RATE,
): number {
  if (source?.gst_enabled === false) return 0;
  const rate = Number(source?.gst_rate);
  if (!Number.isFinite(rate)) return fallback;
  return Math.max(0, Math.min(rate, 1));
}
