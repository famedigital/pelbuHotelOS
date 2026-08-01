export const SITE_NAME = "Pelbu Suites";
export const SITE_DESCRIPTION =
  "Stay, dine and unwind at Pelbu Suites in Olakha, Thimphu, Bhutan.";

const PRODUCTION_CANONICAL = "https://pelbusuites.bt";

function isLocalHostHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  );
}

function isLocalHostUrl(value: string): boolean {
  try {
    return isLocalHostHostname(new URL(value).hostname);
  } catch {
    return true;
  }
}

function vercelOrigin(): string | null {
  const raw = process.env.VERCEL_URL?.trim();
  if (!raw) return null;
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

function configuredOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    vercelOrigin(),
  ].filter((value): value is string => Boolean(value));
}

function pickOrigin(candidates: string[]): string | null {
  const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_URL);
  const inProduction = process.env.NODE_ENV === "production" || onVercel;
  for (const candidate of candidates) {
    if (inProduction && isLocalHostUrl(candidate)) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // Fall through to the next candidate.
    }
  }
  return null;
}

/** Canonical public site origin — never localhost in production builds. */
export function getSiteUrl(): URL {
  const origin =
    pickOrigin(configuredOrigins()) ??
    (typeof window !== "undefined" &&
    !isLocalHostHostname(window.location.hostname)
      ? window.location.origin
      : PRODUCTION_CANONICAL);
  return new URL(origin);
}

/** Absolute URL for QR codes, sitemap, and share links. */
export function absoluteUrl(path = "/"): string {
  if (typeof window !== "undefined") {
    const runtimeOrigin = pickOrigin([
      ...configuredOrigins(),
      window.location.origin,
    ]);
    if (runtimeOrigin) {
      return new URL(path, runtimeOrigin).toString();
    }
  }
  return new URL(path, getSiteUrl()).toString();
}

export const PUBLIC_INDEXABLE_ROUTES = [
  "/",
  "/rooms",
  "/book",
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
  "/guide",
  "/agents",
] as const;
