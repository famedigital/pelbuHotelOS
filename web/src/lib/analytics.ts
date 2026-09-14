/**
 * Google Analytics 4 — public site only.
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID (e.g. G-PC0V8SEBX5) in Vercel Production.
 * Leave unset locally / previews to avoid polluting reports.
 */

export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

/** Paths that must never send page views (desk, staff, payments). */
const PRIVATE_PREFIXES = [
  "/erp",
  "/staff",
  "/login",
  "/agents/app",
  "/agents/portal",
  "/agents/login",
  "/pay",
  "/guest",
  "/laundry",
  "/c/",
  "/api",
] as const;

export function shouldTrackAnalyticsPath(pathname: string | null): boolean {
  if (!pathname || !GA_MEASUREMENT_ID) return false;
  return !PRIVATE_PREFIXES.some((prefix) => {
    if (prefix.endsWith("/")) {
      return pathname.startsWith(prefix) || pathname === prefix.slice(0, -1);
    }
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

/** Client-side custom event (booking CTA, contact, etc.). */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  if (typeof window.gtag !== "function") return;
  const cleaned = params
    ? Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined),
      )
    : undefined;
  window.gtag("event", name, cleaned);
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
