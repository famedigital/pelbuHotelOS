/**
 * Session-lifetime StayHub catalog cache (agents / staff / meals / reg).
 * Avoids re-fetching on every modal open in the same desk tab.
 */

import type { fetchStayHubCatalog } from "@/app/actions/stay-hub";

export type StayHubCatalogData = Extract<
  Awaited<ReturnType<typeof fetchStayHubCatalog>>,
  { ok: true }
>["data"];

let cache: StayHubCatalogData | null = null;

export function getStayHubCatalogCache(): StayHubCatalogData | null {
  return cache;
}

export function setStayHubCatalogCache(data: StayHubCatalogData): void {
  cache = data;
}
