"use client";

import { LiveRefreshBadge } from "@/components/erp/LiveRefreshBadge";

/** Polls assignment/block fingerprints and refreshes the calendar rack. */
export function CalendarLiveRefresh({
  intervalMs = 5000,
}: {
  intervalMs?: number;
}) {
  return (
    <LiveRefreshBadge
      endpoint="/api/erp/calendar-version"
      intervalMs={intervalMs}
      title="Polling for room / booking changes"
    />
  );
}
