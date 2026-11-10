"use client";

import { LiveRefreshBadge } from "@/components/erp/LiveRefreshBadge";
import { calendarPollMs } from "@/lib/free-tier";

/** Room rack follows the desk stream. Version poll is the backup. */
export function CalendarLiveRefresh({
  intervalMs,
}: {
  intervalMs?: number;
}) {
  return (
    <LiveRefreshBadge
      endpoint="/api/erp/calendar-version"
      intervalMs={intervalMs ?? calendarPollMs()}
      title="Live room and booking changes"
    />
  );
}
