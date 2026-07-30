"use client";

import { LiveRefreshBadge } from "@/components/erp/LiveRefreshBadge";

/** Polls arrival / assignment / HK fingerprints for front-desk boards. */
export function FrontDeskLiveRefresh({
  intervalMs = 5000,
}: {
  intervalMs?: number;
}) {
  return (
    <LiveRefreshBadge
      endpoint="/api/erp/front-desk-version"
      intervalMs={intervalMs}
      title="Polling for arrivals, rooms, and HK changes"
    />
  );
}
