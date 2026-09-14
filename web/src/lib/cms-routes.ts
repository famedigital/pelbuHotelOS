/** Public URL for a CMS page slug. Slugs and routes drifted apart over time. */
export function publicPathForSlug(slug: string): string {
  if (slug === "home") return "/";
  if (slug === "dine") return "/menu";
  if (slug === "olakha-thimphu") return "/stay/olakha-thimphu";
  return `/${slug}`;
}
