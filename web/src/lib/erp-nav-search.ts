/** Shared Ctrl+K / mobile More search — token-OR + synonym-friendly matching. */

export type ErpNavSearchItem = {
  title: string;
  href: string;
  keywords?: readonly string[];
  /** Module or group label (palette section heading). */
  context?: string;
};

export function erpNavSearchHaystack(item: ErpNavSearchItem): string {
  return [item.title, item.context, item.href, ...(item.keywords ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** True when any query token matches the haystack (desk slang / aliases). */
export function erpNavMatchesQuery(haystack: string, query: string): boolean {
  const qTokens = normalizeTokens(query);
  if (qTokens.length === 0) return true;
  const hay = haystack.toLowerCase();
  const hayTokens = normalizeTokens(hay.replace(/\//g, " "));
  if (hayTokens.length === 0) return false;

  return qTokens.some((qt) => {
    if (hay.includes(qt)) return true;
    return hayTokens.some((ht) => ht.includes(qt) || qt.includes(ht));
  });
}

/** cmdk filter score — 1 = visible, 0 = hidden. Uses OR across query tokens for desk slang. */
export function erpNavFilterScore(value: string, search: string): number {
  const qTokens = normalizeTokens(search);
  if (qTokens.length === 0) return 1;
  const hay = value.toLowerCase();
  const any = qTokens.some((qt) => {
    if (hay.includes(qt)) return true;
    return normalizeTokens(hay).some(
      (ht) => ht.includes(qt) || qt.includes(ht),
    );
  });
  return any ? 1 : 0;
}

export function filterErpNavItems<T extends ErpNavSearchItem>(
  items: readonly T[],
  query: string,
): T[] {
  const q = query.trim();
  if (!q) return [...items];
  return items.filter((item) =>
    erpNavMatchesQuery(erpNavSearchHaystack(item), q),
  );
}
