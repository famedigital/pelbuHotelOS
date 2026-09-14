"use client";

import { formatBtn } from "@/lib/pricing";
import type { PackageRateCard } from "@/lib/rate-packages";
import type { SeasonKind } from "@/lib/rates";
import { cn } from "@/lib/utils";

export const RATE_YEARS = [2026, 2027] as const;
export type RateYear = (typeof RATE_YEARS)[number];

export const RATE_YEAR_UPLIFT: Record<RateYear, number> = {
  2026: 1,
  2027: 1.2,
};

export type PackageSeasonWindow = {
  kind: SeasonKind;
  startsOn?: string | null;
  endsOn?: string | null;
  dateHint?: string | null;
};

type Props = {
  card: PackageRateCard;
  seasons?: PackageSeasonWindow[];
  currentSeasonKind?: SeasonKind;
  mode?: "public" | "desk-preview";
  taxInclusive?: boolean;
  className?: string;
  emptyMessage?: string;
  showYearTabs?: boolean;
  baseYear?: RateYear;
};

/**
 * Desk package rate preview (platform stub — no public /rates site).
 */
export function RatePackagesTable({
  card,
  seasons = [],
  currentSeasonKind,
  mode = "desk-preview",
  className,
  emptyMessage = "Rates are being updated.",
}: Props) {
  const rooms = card.rooms ?? [];
  const roomOnlyCol = card.columns.find((c) => c.isRoomOnly) ?? card.columns[0];
  if (rooms.length === 0 || !roomOnlyCol) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {emptyMessage}
      </p>
    );
  }

  const seasonKinds: SeasonKind[] = ["peak", "lean", "off"];

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Room</th>
            {seasonKinds.map((k) => (
              <th
                key={k}
                className={cn(
                  "px-3 py-2 font-medium capitalize",
                  currentSeasonKind === k && "text-foreground",
                )}
              >
                {k}
                {seasons.find((s) => s.kind === k)?.dateHint
                  ? ` · ${seasons.find((s) => s.kind === k)?.dateHint}`
                  : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id} className="border-b border-border/60">
              <td className="px-3 py-2 font-medium">{room.name}</td>
              {seasonKinds.map((k) => {
                const cell = room.bySeason?.[k]?.find(
                  (c) => c.columnId === roomOnlyCol.id,
                );
                const amount = cell?.totalBtn ?? cell?.roomBtn;
                return (
                  <td key={k} className="px-3 py-2 tabular-nums">
                    {typeof amount === "number" ? formatBtn(amount) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {mode === "desk-preview" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Package preview (room-only columns). Full meal-package card UI can be
          restored from the implementer brief when needed.
        </p>
      ) : null}
    </div>
  );
}
