"use client";

import { LiveRefreshBadge } from "@/components/erp/LiveRefreshBadge";
import { calendarPollMs } from "@/lib/free-tier";

/** Polls assignment/block fingerprints. Free-tier default ~15s. */
export function CalendarLiveRefresh({
  intervalMs,
}: {
  intervalMs?: number;
}) {
  return (
    <LiveRefreshBadge
      endpoint="/api/erp/calendar-version"
      intervalMs={intervalMs ?? calendarPollMs()}
      title="Live poll for room / booking changes"
    />
  );
}
