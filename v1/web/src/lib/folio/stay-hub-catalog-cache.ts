/**
 * Session-lifetime StayHub catalog cache (agents / staff / meals / reg).
 * Memory first; IndexedDB for cross-navigation when propertyId is known.
 */

import type { fetchStayHubCatalog } from "@/app/actions/stay-hub";
import {
  DESK_CACHE_TTL,
  deskCacheKey,
  getDeskReadCache,
  setDeskReadCache,
} from "@/lib/desk/desk-read-cache";

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

export async function loadStayHubCatalogFromIdb(
  propertyId: string,
): Promise<StayHubCatalogData | null> {
  const row = await getDeskReadCache<StayHubCatalogData>(
    deskCacheKey("stayhub:catalog", propertyId),
    propertyId,
  );
  if (row?.payload) {
    cache = row.payload;
    return row.payload;
  }
  return null;
}

export async function persistStayHubCatalogToIdb(
  propertyId: string,
  data: StayHubCatalogData,
): Promise<void> {
  cache = data;
  await setDeskReadCache({
    key: deskCacheKey("stayhub:catalog", propertyId),
    propertyId,
    payload: data,
    hardMs: DESK_CACHE_TTL.stayhubCatalog.hardMs,
  });
}

export async function persistStayHubSummaryToIdb(
  propertyId: string,
  bookingId: string,
  payload: unknown,
): Promise<void> {
  await setDeskReadCache({
    key: deskCacheKey("stayhub:summary", propertyId, `b:${bookingId}`),
    propertyId,
    payload,
    hardMs: DESK_CACHE_TTL.stayhubSummary.hardMs,
  });
}

export async function loadStayHubSummaryFromIdb<T>(
  propertyId: string,
  bookingId: string,
): Promise<T | null> {
  const row = await getDeskReadCache<T>(
    deskCacheKey("stayhub:summary", propertyId, `b:${bookingId}`),
    propertyId,
  );
  return row?.payload ?? null;
}
