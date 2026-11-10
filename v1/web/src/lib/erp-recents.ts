/** Last desk screens for Ctrl+K — persisted in localStorage (client only). */

export const ERP_RECENTS_STORAGE_KEY = "pelbu_erp_recents_v1";
export const ERP_RECENTS_MAX = 8;

export type ErpRecentRoute = {
  href: string;
  title: string;
  at: number;
};

export function readErpRecents(): ErpRecentRoute[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ERP_RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ErpRecentRoute[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r) =>
          r &&
          typeof r.href === "string" &&
          r.href.startsWith("/erp") &&
          typeof r.title === "string",
      )
      .slice(0, ERP_RECENTS_MAX);
  } catch {
    return [];
  }
}

export function pushErpRecent(entry: { href: string; title: string }): void {
  if (typeof window === "undefined") return;
  const href = entry.href.trim();
  if (!href.startsWith("/erp") || href.startsWith("/erp/login")) return;

  const title = entry.title.trim() || href;
  const prev = readErpRecents().filter((r) => r.href !== href);
  const next: ErpRecentRoute[] = [
    { href, title, at: Date.now() },
    ...prev,
  ].slice(0, ERP_RECENTS_MAX);

  try {
    window.localStorage.setItem(ERP_RECENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota — ignore.
  }
}
