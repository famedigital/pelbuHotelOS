export const SITE_NAME = "Pelbu Suites";
/** Default SERP / social blurb — hotel + local intent, no invented claims. */
export const SITE_DESCRIPTION =
  "Hotel in Olakha, Thimphu, Bhutan — quiet rooms, direct rates, live availability, restaurant, cafe, spa and meeting under one roof. A practical place to stay sleep and eat well.";

/** Public marketing origin for sitemap, robots, JSON-LD, metadataBase. */
export const PRODUCTION_CANONICAL = "https://pelbusuites.bt";

function isLocalHostHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  );
}

/** Vercel deployment hosts must never appear in sitemap / GSC / schema. */
function isVercelDeploymentHostname(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(".vercel.app");
}

function isLocalHostUrl(value: string): boolean {
  try {
    return isLocalHostHostname(new URL(value).hostname);
  } catch {
    return true;
  }
}

function isVercelDeploymentUrl(value: string): boolean {
  try {
    return isVercelDeploymentHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}

function onVercel(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_URL);
}

/**
 * Origins that may be used for absolute public links.
 * Rejects localhost on Vercel and always rejects *.vercel.app so sitemap
 * never lists preview deployment URLs (GSC "URL not allowed").
 */
function firstUsableOrigin(candidates: Array<string | null | undefined>): string | null {
  const vercel = onVercel();
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    if (isVercelDeploymentUrl(value)) continue;
    if (vercel && isLocalHostUrl(value)) continue;
    try {
      return new URL(value).origin;
    } catch {
      // Fall through.
    }
  }
  return null;
}

/**
 * Canonical public site origin (sitemap / metadataBase / SEO).
 * Prefer NEXT_PUBLIC_SITE_URL; never a Vercel deployment hostname.
 */
export function getSiteUrl(): URL {
  const origin =
    firstUsableOrigin([
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      typeof window !== "undefined" ? window.location.origin : null,
    ]) ??
    (onVercel() || process.env.NODE_ENV === "production"
      ? PRODUCTION_CANONICAL
      : "http://localhost:3000");
  return new URL(origin);
}

/**
 * Absolute URL for QR codes, sitemap, share links, and schema.
 * Prefer APP_URL when it is a real custom host; never *.vercel.app.
 */
export function absoluteUrl(path = "/"): string {
  const origin =
    firstUsableOrigin([
      typeof window !== "undefined" ? null : process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      typeof window !== "undefined" ? window.location.origin : null,
    ]) ?? getSiteUrl().origin;
  return new URL(path, origin).toString();
}

export const PUBLIC_INDEXABLE_ROUTES = [
  "/",
  "/rooms",
  "/rates",
  // /book is noindex (funnel page) — keep it out of the sitemap
  "/menu",
  "/cafe",
  "/restaurant",
  "/bar",
  "/spa",
  "/meeting",
  "/services",
  "/salon",
  "/gallery",
  "/contact",
  "/faq",
  "/stay/olakha-thimphu",
  "/stay/hotels-in-thimphu",
  "/stay/food-in-thimphu",
  "/stay/facilities-service",
  "/guide",
  "/agents",
  "/careers",
] as const;
