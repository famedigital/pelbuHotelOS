"use client";

import { fetchReservationsListSlim } from "@/app/actions/desk-read-loaders";
import { DeskSyncChip } from "@/components/erp/DeskSyncChip";
import {
  DESK_CACHE_TTL,
  deskCacheKey,
  setDeskReadCache,
} from "@/lib/desk/desk-read-cache";
import { useDeskSwr } from "@/hooks/use-desk-swr";
import { useEffect } from "react";

/**
 * Writes SSR reservation fingerprint to IDB and quietly revalidates.
 * Full board stays SSR; this powers 2nd-open sync chip + Fast Book invalidation.
 */
export function ReservationsListCacheBridge({
  propertyId,
  bucket,
  rowCount,
}: {
  propertyId: string;
  bucket: string;
  rowCount: number;
}) {
  const key = deskCacheKey(
    "reservations:list",
    propertyId,
    `b:${bucket || "all"}`,
  );

  const swr = useDeskSwr({
    key,
    propertyId,
    ttl: DESK_CACHE_TTL.reservationsList,
    label: "reservations",
    toastOnSync: false,
    fetcher: async (signal) => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const r = await fetchReservationsListSlim({
        bucket: bucket || "all",
        limit: 250,
      });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });

  useEffect(() => {
    void setDeskReadCache({
      key,
      propertyId,
      payload: { bucket, rowCount, seededAt: Date.now() },
      hardMs: DESK_CACHE_TTL.reservationsList.hardMs,
    });
  }, [key, propertyId, bucket, rowCount]);

  return (
    <DeskSyncChip
      syncing={swr.syncing}
      source={swr.source}
      className="ml-auto"
    />
  );
}
