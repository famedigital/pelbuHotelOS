/**
 * Mirrors `packages/core/src/property/normalize-property-slug.ts` without importing
 * `@hotel-os/core` — Next must load `next.config.ts` before workspace resolution runs.
 */
const PROPERTY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function normalizePropertySlugInput(raw: string | undefined | null): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (isUuid(s)) return s;
  if (PROPERTY_SLUG_RE.test(s)) return s.toLowerCase();
  const segments = s
    .split(/\s*[·|•]\s*/u)
    .map((p) => p.trim())
    .filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    if (isUuid(seg)) return seg;
    if (PROPERTY_SLUG_RE.test(seg)) return seg.toLowerCase();
  }
  const tokens = s.match(/[a-z0-9]+(?:-[a-z0-9]+)*/gi);
  if (tokens?.length) {
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const t = tokens[i];
      if (PROPERTY_SLUG_RE.test(t)) return t.toLowerCase();
    }
  }
  return null;
}

const FALLBACK_SLUG = "pelbu-olakha";

/**
 * Reads v2 tenant slug from env (build + server), normalizing mistaken values like
 * `Staff PIN · pelbu-suites-olakha` to `pelbu-suites-olakha`.
 */
export function resolveDefaultV2PropertySlugFromEnv(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_SLUG,
    process.env.DEFAULT_PROPERTY_SLUG,
    process.env.FLAGSHIP_PROPERTY_SLUG,
    process.env.NEXT_PUBLIC_FLAGSHIP_PROPERTY_SLUG,
  ];
  for (const c of candidates) {
    const n = normalizePropertySlugInput(c);
    if (n) return n;
  }
  return FALLBACK_SLUG;
}
