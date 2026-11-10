"use client";

import { buildStayNightGrid } from "@/lib/erp/stay-night-grid";
import { formatGuestBtn } from "@/lib/pricing";
import type { RoomRateTaxSettings } from "@/lib/room-rate-tax";
import { useMemo } from "react";

/**
 * eZee Rate Information lite — read-only per-night tax split in StayHub.
 * Custom nightly still goes through AgreedRateForm (manager PIN).
 */
export function StayHubRateNightsPanel({
  checkIn,
  checkOut,
  baseNightBtn,
  adults,
  children,
  tax,
  taxExemptGst,
  taxExemptService,
  rateTaxMode,
}: {
  checkIn: string;
  checkOut: string;
  baseNightBtn: number | null;
  adults: number;
  children: number;
  tax: RoomRateTaxSettings;
  taxExemptGst?: boolean;
  taxExemptService?: boolean;
  rateTaxMode?: "inclusive" | "exclusive" | null;
}) {
  const grid = useMemo(() => {
    if (baseNightBtn == null || !checkIn || !checkOut) return null;
    return buildStayNightGrid({
      checkIn,
      checkOut,
      baseNightBtn,
      adults,
      children,
      tax,
      taxExemptGst,
      taxExemptService,
      rateTaxMode: rateTaxMode ?? undefined,
    });
  }, [
    baseNightBtn,
    checkIn,
    checkOut,
    adults,
    children,
    tax,
    taxExemptGst,
    taxExemptService,
    rateTaxMode,
  ]);

  if (!grid || grid.nights.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Set arrival / departure and a nightly rate to see the night grid.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Per-night room tax split (FO view). Nightly posts still follow night
        audit / folio rules.
        {taxExemptGst || taxExemptService ? (
          <span className="ml-1 text-amber-800 dark:text-amber-200">
            Tax exempt flags on this stay.
          </span>
        ) : null}
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[32rem] text-left text-xs">
          <thead className="bg-muted/40 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-2 py-1.5">Date</th>
              <th className="px-2 py-1.5">Day</th>
              <th className="px-2 py-1.5 text-right">Base</th>
              <th className="px-2 py-1.5 text-right">SC</th>
              <th className="px-2 py-1.5 text-right">GST</th>
              <th className="px-2 py-1.5 text-right">Total</th>
              <th className="px-2 py-1.5 text-right">A/C</th>
            </tr>
          </thead>
          <tbody>
            {grid.nights.map((n) => (
              <tr key={n.date} className="border-t border-border/60">
                <td className="px-2 py-1 font-mono tabular-nums">{n.date}</td>
                <td className="px-2 py-1 text-muted-foreground">{n.dayLabel}</td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {formatGuestBtn(n.baseBtn)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {formatGuestBtn(n.serviceBtn)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {formatGuestBtn(n.gstBtn)}
                </td>
                <td className="px-2 py-1 text-right font-medium tabular-nums">
                  {formatGuestBtn(n.totalBtn)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                  {n.adults}/{n.children}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30 font-medium">
            <tr>
              <td className="px-2 py-1.5" colSpan={2}>
                Full stay
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatGuestBtn(grid.totals.baseBtn)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatGuestBtn(grid.totals.serviceBtn)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatGuestBtn(grid.totals.gstBtn)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatGuestBtn(grid.totals.totalBtn)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
