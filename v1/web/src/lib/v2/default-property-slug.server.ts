import "server-only";

import { resolveDefaultV2PropertySlugFromEnv } from "./resolve-default-v2-property-slug";

/**
 * Default tenant slug for v2 PIN and desk API queries when the browser bundle
 * cannot read non-public env (e.g. FLAGSHIP_PROPERTY_SLUG).
 */
export function getServerDefaultV2PropertySlug(): string {
  return resolveDefaultV2PropertySlugFromEnv();
}
