"use client";

import { LiveRefreshBadge } from "@/components/erp/LiveRefreshBadge";
import { deskPollMs } from "@/lib/free-tier";

/** Pushes arrival / assignment / HK changes. Fingerprint poll is only the backup. */
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
      title="Live arrivals, rooms, and housekeeping"
      onInvalidate={onInvalidate}
    />
  );
}
