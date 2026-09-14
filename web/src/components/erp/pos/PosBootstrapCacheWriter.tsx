"use client";

import {
  DESK_CACHE_TTL,
  deskCacheKey,
  getDeskReadCache,
  setDeskReadCache,
} from "@/lib/desk/desk-read-cache";
import type { OpenPosTicket } from "@/lib/pos";
import { useEffect, useRef } from "react";

/** Persist POS bootstrap + tickets to IndexedDB after SSR paint. */
export function PosBootstrapCacheWriter({
  propertyId,
  openTickets,
  settledTickets,
  menuItemCount,
  tableCount,
}: {
  propertyId: string;
  openTickets: OpenPosTicket[];
  settledTickets: OpenPosTicket[];
  menuItemCount: number;
  tableCount: number;
}) {
  const wrote = useRef(false);

  useEffect(() => {
    if (!propertyId) return;
    void setDeskReadCache({
      key: deskCacheKey("pos:tickets", propertyId),
      propertyId,
      payload: { openTickets, settledTickets },
      hardMs: DESK_CACHE_TTL.posTickets.hardMs,
    });
    void setDeskReadCache({
      key: deskCacheKey("pos:bootstrap", propertyId),
      propertyId,
      payload: {
        menuItemCount,
        tableCount,
        openTicketCount: openTickets.length,
        updatedHint: Date.now(),
      },
      hardMs: DESK_CACHE_TTL.posBootstrap.hardMs,
    });
    wrote.current = true;
  }, [
    propertyId,
    openTickets,
    settledTickets,
    menuItemCount,
    tableCount,
  ]);

  return null;
}

/** Read cached tickets once (for hydrate-before-SSR edge cases). */
export async function readCachedPosTickets(
  propertyId: string,
): Promise<{
  openTickets: OpenPosTicket[];
  settledTickets: OpenPosTicket[];
} | null> {
  const row = await getDeskReadCache<{
    openTickets: OpenPosTicket[];
    settledTickets: OpenPosTicket[];
  }>(deskCacheKey("pos:tickets", propertyId), propertyId);
  return row?.payload ?? null;
}
