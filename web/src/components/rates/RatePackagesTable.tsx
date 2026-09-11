"use client";

import { Badge } from "@/components/ui/badge";
import { formatBtn } from "@/lib/pricing";
import {
  PACKAGE_OCCUPANCY_ADULTS,
  scalePackageRateCard,
  type PackageRateCard,
} from "@/lib/rate-packages";
import type { SeasonKind } from "@/lib/rates";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const SEASON_ORDER: SeasonKind[] = ["peak", "lean", "off"];

/** Published rack years on the public rates page. */
export const RATE_YEARS = [2026, 2027] as const;
export type RateYear = (typeof RATE_YEARS)[number];

/** 2027 all-in = 2026 all-in × 1.20 (base +20%; SC+GST already included). */
export const RATE_YEAR_UPLIFT: Record<RateYear, number> = {
  2026: 1,
  2027: 1.2,
};

function seasonLabel(kind: SeasonKind): string {
  if (kind === "peak") return "Peak";
  if (kind === "off") return "Off";
  return "Lean";
}

export type PackageSeasonWindow = {
  kind: SeasonKind;
  startsOn?: string | null;
  endsOn?: string | null;
  /** Desk may pass MD–MD style range string */
  dateHint?: string | null;
};

type Props = {
  card: PackageRateCard;
  seasons?: PackageSeasonWindow[];
  currentSeasonKind?: SeasonKind;
  /** public = website styling; desk-preview = compact desk preview */
  mode?: "public" | "desk-preview";
  taxInclusive?: boolean;
  className?: string;
  emptyMessage?: string;
  /** When true, show 2026 / 2027 year tabs (public site). */
  showYearTabs?: boolean;
  /** Base year for `card` amounts (DB rack). Default 2026. */
  baseYear?: RateYear;
};

function formatShortDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Package rate card: season segments + Room only / +meal columns.
 * Shared by public /rates and desk /erp/rates preview.
 */
export function RatePackagesTable({
  card,
  seasons = [],
  currentSeasonKind,
  mode = "public",
  taxInclusive,
  className,
  emptyMessage = "Rates are being updated. Call the desk or book for a live quote.",
  showYearTabs = false,
  baseYear = 2026,
}: Props) {
  const initialSeason =
    currentSeasonKind && SEASON_ORDER.includes(currentSeasonKind)
      ? currentSeasonKind
      : SEASON_ORDER[0];
  const [activeSeason, setActiveSeason] = useState<SeasonKind>(initialSeason);
  const [activeYear, setActiveYear] = useState<RateYear>(baseYear);

  const displayCard = useMemo(() => {
    const factor = RATE_YEAR_UPLIFT[activeYear] / RATE_YEAR_UPLIFT[baseYear];
    if (factor === 1) return card;
    return scalePackageRateCard(card, factor);
  }, [card, activeYear, baseYear]);

  if (card.rooms.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const seasonMeta = seasons.find((s) => s.kind === activeSeason);
  const isPublic = mode === "public";
  const occupancy = displayCard.occupancyAdults || PACKAGE_OCCUPANCY_ADULTS;

  return (
    <div className={cn("space-y-4", className)}>
      {showYearTabs ? (
        <div className="flex flex-wrap items-center gap-2">
          {RATE_YEARS.map((year) => {
            const isActive = year === activeYear;
            return (
              <button
                key={year}
                type="button"
                onClick={() => setActiveYear(year)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-semibold tracking-wide transition-colors",
                  isActive
                    ? "border-sky-600/50 bg-sky-600 text-white shadow-sm"
                    : "border-input text-muted-foreground hover:bg-muted",
                )}
              >
                {year}
                {year === 2027 ? (
                  <span
                    className={cn(
                      "text-[10px] font-medium uppercase tracking-wider",
                      isActive ? "text-sky-100" : "text-muted-foreground",
                    )}
                  >
                    +20% base
                  </span>
                ) : null}
              </button>
            );
          })}
          <p className="w-full text-xs text-muted-foreground sm:ml-2 sm:w-auto">
            {activeYear === 2026
              ? "2026 public rack · all-in (10% SC + 5% GST)."
              : "2027 = 2026 base +20%, then SC+GST (shown all-in). Bookings in 2026 use the 2026 tab."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {SEASON_ORDER.map((kind) => {
          const isActive = kind === activeSeason;
          const isNow = kind === currentSeasonKind && activeYear === baseYear;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setActiveSeason(kind)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors",
                isActive
                  ? isPublic
                    ? "border-sky-600/40 bg-sky-500/10 text-foreground"
                    : "border-accent bg-accent/10 text-foreground"
                  : "border-input text-muted-foreground hover:bg-muted",
              )}
            >
              {seasonLabel(kind)}
              {isNow ? (
                <Badge
                  variant={isPublic ? "sky" : "secondary"}
                  className="text-[10px]"
                >
                  Now
                </Badge>
              ) : null}
            </button>
          );
        })}
        {taxInclusive != null ? (
          <span
            className={cn(
              "ml-auto inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
              taxInclusive
                ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-input bg-muted text-muted-foreground",
            )}
          >
            {taxInclusive ? "Inc. GST+SC" : "Excl. GST+SC"}
          </span>
        ) : null}
      </div>

      {seasonMeta?.dateHint || (seasonMeta?.startsOn && seasonMeta?.endsOn) ? (
        <p className="text-xs text-muted-foreground">
          {seasonMeta.dateHint ??
            `${formatShortDate(seasonMeta.startsOn!)} – ${formatShortDate(seasonMeta.endsOn!)}`}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Per room / night
        {showYearTabs ? (
          <>
            {" "}
            · <span className="font-medium text-foreground">{activeYear}</span>{" "}
            public rack
          </>
        ) : null}
        . Meal packages include{" "}
        <span className="font-medium text-foreground">
          {occupancy} adults
        </span>{" "}
        at the adult meal rate (double occupancy). Trade / agent rates are
        separate (from Nu 5,600 EP peak deluxe) — not shown on this public card.
      </p>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-card px-4 py-3 font-medium text-foreground"
              >
                Room
              </th>
              {displayCard.columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="min-w-[7.5rem] px-3 py-3 font-medium text-foreground"
                >
                  <span className="block normal-case tracking-normal">
                    {col.isRoomOnly ? col.label : `+ ${col.shortLabel}`}
                  </span>
                  {!col.isRoomOnly && col.amountPerAdultNight != null ? (
                    <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                      meals ×{occupancy} @ {formatBtn(col.amountPerAdultNight)}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                      EP
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayCard.rooms.map((room) => {
              const cells = room.bySeason[activeSeason] ?? [];
              return (
                <tr key={room.id} className="border-b last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium text-foreground"
                  >
                    {room.name}
                    {mode === "desk-preview" ? (
                      <span className="ml-2 font-mono text-[10px] font-normal text-muted-foreground">
                        {room.code}
                      </span>
                    ) : null}
                  </th>
                  {displayCard.columns.map((col) => {
                    const cell = cells.find((c) => c.columnId === col.id);
                    const total = cell?.totalBtn;
                    return (
                      <td key={col.id} className="px-3 py-3 align-top">
                        {total == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="font-semibold tabular-nums text-foreground">
                              {formatBtn(total)}
                            </span>
                            {!col.isRoomOnly &&
                            cell?.childMealBtn != null &&
                            cell.childMealBtn > 0 ? (
                              <p className="text-[10px] leading-snug text-muted-foreground">
                                Child meal 6–12{" "}
                                <span className="tabular-nums">
                                  +{formatBtn(cell.childMealBtn)}
                                </span>
                                /n
                              </p>
                            ) : null}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {displayCard.childNote}
      </p>
    </div>
  );
}
