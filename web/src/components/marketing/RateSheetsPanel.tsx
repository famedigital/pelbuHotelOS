"use client";

import type {
  MarketingRateSheetRow,
  RateSheetBrand,
} from "@/lib/marketing/rate-sheet";

/** Temporary stub after website purge. */
export function RateSheetsPanel(_props: {
  sheets: MarketingRateSheetRow[];
  brand: RateSheetBrand;
}) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      Rate sheets UI stub — restore RateSheetsPanel when briefed.
    </p>
  );
}
