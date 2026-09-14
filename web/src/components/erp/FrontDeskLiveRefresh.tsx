"use client";

import { LiveRefreshBadge } from "@/components/erp/LiveRefreshBadge";
import { deskPollMs } from "@/lib/free-tier";

/** Polls arrival / assignment / HK fingerprints. Free-tier default ~15s. */
export function FrontDeskLiveRefresh({
  intervalMs,
  onInvalidate,
}: {
  intervalMs?: number;
  /** Prefer patch loaders; falls back to router.refresh on throw. */
  onInvalidate?: () => void | Promise<void>;
}) {
  return (
    <LiveRefreshBadge
      endpoint="/api/erp/front-desk-version"
      intervalMs={intervalMs ?? deskPollMs()}
      title="Polling for arrivals, rooms, and HK changes"
      onInvalidate={onInvalidate}
    />
  );
}
