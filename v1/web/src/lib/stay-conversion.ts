/**
 * Stay funnel helpers — keep F&B out of primary guest conversion.
 * CMS may still sell food on dedicated outlet pages.
 */

const FOODISH =
  /^\/?(menu|order|dine|cafe|restaurant|bar|pastry)(\?|$|\/)/i;

export function isFoodishPath(href: string | null | undefined): boolean {
  if (!href) return false;
  try {
    const path = href.startsWith("http")
      ? new URL(href).pathname
      : href.split("?")[0];
    return FOODISH.test(path);
  } catch {
    return FOODISH.test(href);
  }
}

/** Secondary hero CTA: rates unless CMS provides a non-food stay path. */
export function staySecondaryCta(cms?: {
  secondary_cta_href?: string | null;
  secondary_cta_label?: string | null;
} | null): { href: string; label: string } {
  const href = cms?.secondary_cta_href?.trim() || "";
  const label = cms?.secondary_cta_label?.trim() || "";
  if (href && !isFoodishPath(href)) {
    return {
      href,
      label: label || "See room rates",
    };
  }
  return { href: "/rates", label: "See room rates" };
}
