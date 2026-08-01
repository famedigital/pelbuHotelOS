"use client";

import { LiveRefreshBadge } from "@/components/erp/LiveRefreshBadge";

/** Polls assignment/block fingerprints and refreshes the calendar rack.
 * Browser Realtime is intentionally avoided on desk (service-role fingerprint
 * endpoint); poll interval keeps the rack live without exposing admin keys.
 */
export function CalendarLiveRefresh({
  intervalMs = 4000,
}: {
  intervalMs?: number;
}) {
  return (
    <LiveRefreshBadge
      endpoint="/api/erp/calendar-version"
      intervalMs={intervalMs}
      title="Live poll for room / booking changes"
    />
  );
}
