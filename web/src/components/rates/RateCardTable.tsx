import { Badge } from "@/components/ui/badge";
import { formatBtn } from "@/lib/pricing";
import {
  SEASON_ORDER,
  seasonLabel,
  type RateCardRoom,
  type RateCardSeason,
} from "@/lib/rate-card";
import type { SeasonKind } from "@/lib/rates";
import type { ReactNode } from "react";

function amountCell(
  room: RateCardRoom,
  kind: SeasonKind,
  current: SeasonKind,
): ReactNode {
  const amount = room.amounts[kind];
  if (amount == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={
        kind === current
          ? "font-semibold tabular-nums text-foreground"
          : "tabular-nums text-foreground"
      }
    >
      {formatBtn(amount)}
    </span>
  );
}

type Props = {
  rooms: RateCardRoom[];
  seasons: RateCardSeason[];
  currentSeasonKind: SeasonKind;
  caption?: string;
  emptyMessage?: string;
};

/**
 * Season columns × room rows. Amounts come from room_rates only — never invents Nu.
 */
export function RateCardTable({
  rooms,
  seasons,
  currentSeasonKind,
  caption,
  emptyMessage = "Rates are being updated. Call the desk or book for a live quote.",
}: Props) {
  if (rooms.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const kinds = SEASON_ORDER.filter((k) =>
    seasons.some((s) => s.kind === k),
  );
  const cols = kinds.length > 0 ? kinds : SEASON_ORDER;

  return (
    <div className="overflow-x-auto">
      {caption ? (
        <p className="mb-2 text-xs text-muted-foreground">{caption}</p>
      ) : null}
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-3 pr-4 font-semibold text-foreground">
              Room type
            </th>
            {cols.map((kind) => {
              const window = seasons.find((s) => s.kind === kind);
              const isCurrent = kind === currentSeasonKind;
              return (
                <th
                  key={kind}
                  scope="col"
                  className="px-2 py-3 font-semibold text-foreground"
                >
                  <span className="inline-flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5">
                      {seasonLabel(kind)}
                      {isCurrent ? (
                        <Badge variant="sky" className="text-[10px]">
                          Now
                        </Badge>
                      ) : null}
                    </span>
                    {window?.startsOn && window?.endsOn ? (
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {formatShortDate(window.startsOn)} –{" "}
                        {formatShortDate(window.endsOn)}
                      </span>
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id} className="border-b border-border/70">
              <th
                scope="row"
                className="py-3 pr-4 text-left font-medium text-foreground"
              >
                {room.name}
              </th>
              {cols.map((kind) => (
                <td key={`${room.id}-${kind}`} className="px-2 py-3">
                  {amountCell(room, kind, currentSeasonKind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
