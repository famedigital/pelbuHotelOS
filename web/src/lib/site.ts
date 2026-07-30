export const SITE_NAME = "Pelbu Suites";
export const SITE_DESCRIPTION =
  "Stay, dine and unwind at Pelbu Suites in Olakha, Thimphu, Bhutan.";

export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      // Fall through to the production canonical instead of emitting bad URLs.
    }
  }
  return new URL("https://pelbusuites.bt");
}

export function absoluteUrl(path = "/"): string {
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
