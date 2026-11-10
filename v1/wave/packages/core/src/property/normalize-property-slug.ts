/** Matches tenant slugs like `pelbu-suites-olakha` or `demo-hotel`. */
const PROPERTY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/** RFC4122 UUID (same shape as `z.string().uuid()`). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Returns a clean `properties.slug` value (or a UUID for `property_id` resolution).
 *
 * Defends against mis-set env / props that copy UI badge text, e.g.
 * `Staff PIN · pelbu-suites-olakha`, which must not be sent to `/v1/auth/staff`.
 */
export function normalizePropertySlugInput(
  raw: string | undefined | null,
): string | null {
  const s = raw?.trim();
  if (!s) return null;

  if (isUuid(s)) {
    return s;
  }

  if (PROPERTY_SLUG_RE.test(s)) {
    return s.toLowerCase();
  }

  const segments = s
    .split(/\s*[·|•]\s*/u)
    .map((p) => p.trim())
    .filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    if (isUuid(seg)) return seg;
    if (PROPERTY_SLUG_RE.test(seg)) {
      return seg.toLowerCase();
    }
  }

  const tokens = s.match(/[a-z0-9]+(?:-[a-z0-9]+)*/gi);
  if (tokens?.length) {
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const t = tokens[i];
      if (PROPERTY_SLUG_RE.test(t)) {
        return t.toLowerCase();
      }
    }
  }

  return null;
}
