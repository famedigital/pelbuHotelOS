"use client";

import {
  primarySurfaceShare,
  recordDeskSurfaceVisit,
} from "@/lib/erp/desk-surface-metrics";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Silent session counter for StayView/Hub/POS share (Phase 5 metrics). */
export function DeskSurfaceMetrics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname?.startsWith("/erp")) return;
    const c = recordDeskSurfaceVisit(
      pathname,
      searchParams?.toString() ?? "",
    );
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      const pct = Math.round(primarySurfaceShare(c) * 100);
      console.debug(`[desk-surface] primary ${pct}%`, c);
    }
  }, [pathname, searchParams]);

  return null;
}
