import { unstable_cache } from "next/cache";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import { publicForceDynamic } from "@/lib/free-tier";

/** Cache tag helpers for public marketing ISR. */
export function cmsTag(propertyId: string) {
  return `cms:${propertyId}`;
}

export function roomsMktTag(propertyId: string) {
  return `rooms-mkt:${propertyId}`;
}

export function homeTag(propertyId: string) {
  return `home:${propertyId}`;
}

export function menuCatalogTag(propertyId: string) {
  return `menu-catalog:${propertyId}`;
}

export function ratesPublicTag(propertyId: string) {
  return `rates-public:${propertyId}`;
}

/** All public tags for a property — use on identity/settings publish. */
export function allPublicTags(propertyId: string): string[] {
  return [
    cmsTag(propertyId),
    roomsMktTag(propertyId),
    homeTag(propertyId),
    menuCatalogTag(propertyId),
    ratesPublicTag(propertyId),
  ];
}

/**
 * Property-scoped Next data cache. Skipped when PUBLIC_FORCE_DYNAMIC=1.
 * Publish actions must call revalidateTag for the same tags.
 */
export async function cachedPublicByProperty<T>(
  keyParts: string[],
  tagFor: (propertyId: string) => string | string[],
  fn: (propertyId: string) => Promise<T>,
  empty: T,
  revalidate = 60,
): Promise<T> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return empty;
  if (publicForceDynamic()) return fn(propertyId);

  const tags = [tagFor(propertyId)].flat();
  const cached = unstable_cache(
    () => fn(propertyId),
    [...keyParts, propertyId],
    { tags, revalidate },
  );
  return cached();
}
