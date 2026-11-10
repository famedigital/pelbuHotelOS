/** Display label for a category slug — fallback title-cases slug. */
export function formatInventoryCategory(slug: string, names?: Map<string, string>): string {
  const mapped = names?.get(slug);
  if (mapped) return mapped;
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type InventoryCategoryRow = {
  slug: string;
  name: string;
  sort_order: number;
};

export function categoryNameMap(rows: InventoryCategoryRow[]): Map<string, string> {
  return new Map(rows.map((r) => [r.slug, r.name]));
}
