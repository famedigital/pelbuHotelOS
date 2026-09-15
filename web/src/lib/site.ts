export const SITE_NAME = "Innora";
/** Full product name for titles and lockups. */
export const SITE_FULL_NAME = "Innora — hotel software for Bhutan";
/** Platform blurb — cloud PMS for Bhutan operations. */
export const SITE_DESCRIPTION =
  "Hotel software for Bhutan — front desk, folio, POS, and multi-property control. Clear modules, BTN pricing, and local distributor support.";

/** Marketing pages that may be indexed. */
export const PUBLIC_INDEXABLE_ROUTES = [
  "/",
  "/pricing",
  "/conditions",
  "/demo",
  "/for/independent",
  "/for/chain",
  "/for/leased",
  "/status",
  "/changelog",
] as const;

/** Canonical app origin for metadata / absolute links (env or local default). */
export const PRODUCTION_CANONICAL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000";

function isLocalHostHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  );
}

/** Vercel deployment hosts must never appear as canonical. */
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
 * Rejects localhost on Vercel and always rejects *.vercel.app.
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
 * Canonical app origin (metadataBase / absolute URLs).
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
      ? firstUsableOrigin([PRODUCTION_CANONICAL]) ?? "http://localhost:3000"
      : "http://localhost:3000");
  return new URL(origin);
}

/**
 * Absolute URL for QR codes, share links, and schema.
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
