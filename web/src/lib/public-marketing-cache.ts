/**
 * Marketing pages use a static `export const revalidate = 60` (Next requires
 * route segment config to be statically analyzable — do not assign from a helper).
 *
 * Kill-switch `PUBLIC_FORCE_DYNAMIC=1` skips `unstable_cache` in loaders
 * (`cachedPublicByProperty`). Tag bust on publish still refreshes CDN HTML.
 */
export const PUBLIC_MARKETING_REVALIDATE_SECONDS = 60;
