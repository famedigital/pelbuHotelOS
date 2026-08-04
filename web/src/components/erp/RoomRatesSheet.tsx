"use client";

import {
  batchUpsertRoomRates,
  type ErpRatesState,
} from "@/app/actions/erp-rates";
import { childRateFromAdult } from "@/lib/child-packages";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useActionState, useCallback, useMemo, useState } from "react";

export type RateMatrixRow = {
  id: string | null;
  room_type_id: string;
  room_type_name: string;
  season_kind: string;
  rate_tier: string;
  amount_btn: number;
};

export type RoomTypeLite = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
};

export type SeasonWindow = {
  id?: string;
  kind: string;
  starts_on: string;
  ends_on: string;
};

const SEASONS = ["peak", "lean", "off"] as const;
const TIERS = [
  { code: "public", label: "Public / rack" },
  { code: "agents", label: "Agents" },
  { code: "mou_agents", label: "MOU agents" },
  { code: "friends", label: "Friends" },
  { code: "family", label: "Family" },
  { code: "mutual_friends", label: "Mutual friends" },
] as const;

const initial: ErpRatesState = { ok: false };

type CellKey = `${string}:${string}:${string}`;

function cellKey(roomTypeId: string, season: string, tier: string): CellKey {
  return `${roomTypeId}:${season}:${tier}`;
}

function formatSeasonDates(seasons: SeasonWindow[], kind: string): string {
  const windows = seasons.filter((s) => s.kind === kind);
  if (windows.length === 0) return "";
  return windows
    .map((w) => `${w.starts_on.slice(5)} → ${w.ends_on.slice(5)}`)
    .join(", ");
}

const PRIMARY_TIERS = TIERS.filter((t) => t.code === "public");
const ADVANCED_TIERS = TIERS.filter((t) => t.code !== "public");

export function RoomRatesSheet({
  rows,
  roomTypes,
  seasons,
  ratesInclusiveOfGstSc = false,
  defaultTier = "public",
  advancedTiersDisclosure = false,
}: {
  rows: RateMatrixRow[];
  roomTypes: RoomTypeLite[];
  seasons: SeasonWindow[];
  /** Property policy: sheet Nu inclusive of GST + SC. */
  ratesInclusiveOfGstSc?: boolean;
  /** Initial market tier tab. */
  defaultTier?: string;
  /**
   * When true, public is primary; other market tiers are behind a disclosure
   * so small hotels are not forced through six tabs on first open.
   */
  advancedTiersDisclosure?: boolean;
}) {
  const guestRooms = roomTypes.filter((r) => r.inventory_kind === "sellable_guest");
  const [activeTier, setActiveTier] = useState<string>(defaultTier);
  const [showAdvancedTiers, setShowAdvancedTiers] = useState(false);

  const savedByKey = useMemo(() => {
    const map = new Map<CellKey, number>();
    for (const row of rows) {
      map.set(cellKey(row.room_type_id, row.season_kind, row.rate_tier), row.amount_btn);
    }
    return map;
  }, [rows]);

  const [draftByKey, setDraftByKey] = useState<Map<CellKey, string>>(() => new Map());
  const [state, action, pending] = useActionState(batchUpsertRoomRates, initial);

  const getDraft = useCallback(
    (roomTypeId: string, season: string, tier: string): string => {
      const key = cellKey(roomTypeId, season, tier);
      if (draftByKey.has(key)) return draftByKey.get(key)!;
      const saved = savedByKey.get(key);
      return saved != null && saved > 0 ? String(saved) : "";
    },
    [draftByKey, savedByKey],
  );

  const setDraft = useCallback(
    (roomTypeId: string, season: string, tier: string, value: string) => {
      const key = cellKey(roomTypeId, season, tier);
      setDraftByKey((prev) => {
        const next = new Map(prev);
        next.set(key, value);
        return next;
      });
    },
    [],
  );

  const dirtyCells = useMemo(() => {
    const changes: Array<{
      room_type_id: string;
      season_kind: string;
      rate_tier: string;
      amount_btn: number;
    }> = [];

    for (const rt of guestRooms) {
      for (const season of SEASONS) {
        const key = cellKey(rt.id, season, activeTier);
        if (!draftByKey.has(key)) continue;

        const draftRaw = draftByKey.get(key) ?? "";
        const draftNum = draftRaw.trim() === "" ? 0 : Number(draftRaw);
        const saved = savedByKey.get(key) ?? 0;

        if (!Number.isFinite(draftNum) || draftNum < 0) continue;
        if (draftNum !== saved) {
          changes.push({
            room_type_id: rt.id,
            season_kind: season,
            rate_tier: activeTier,
            amount_btn: draftNum,
          });
        }
      }
    }
    return changes;
  }, [activeTier, draftByKey, guestRooms, savedByKey]);

  if (guestRooms.length === 0) {
    return (
      <p className="rounded-lg border bg-card px-5 py-6 text-sm text-muted-foreground">
        No sellable guest room types configured. Add room types under Settings → Rooms
        first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
            ratesInclusiveOfGstSc
              ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-input bg-muted text-muted-foreground",
          )}
          title={
            ratesInclusiveOfGstSc
              ? "Sheet Nu is guest all-in (GST + SC when SC default is on)"
              : "Sheet Nu is exclusive of GST and SC — posting adds them"
          }
        >
          {ratesInclusiveOfGstSc ? "Inc. GST+SC" : "Excl. GST+SC"}
        </span>
        <span className="inline-flex items-center rounded-md border border-input bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
          Child package: 0–6 free · 6–12 = 50% adult (auto)
        </span>
        <Link
          href="/erp/settings?tab=commercial"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Change in Rates &amp; meals
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRIMARY_TIERS.map((tier) => (
          <button
            key={tier.code}
            type="button"
            onClick={() => setActiveTier(tier.code)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors",
              activeTier === tier.code
                ? "border-accent bg-accent/10 text-foreground"
                : "border-input text-muted-foreground hover:bg-muted",
            )}
          >
            {tier.label}
          </button>
        ))}
        {advancedTiersDisclosure ? (
          <>
            <button
              type="button"
              onClick={() => setShowAdvancedTiers((v) => !v)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors",
                showAdvancedTiers
                  ? "border-input bg-muted text-foreground"
                  : "border-dashed border-input text-muted-foreground hover:bg-muted",
              )}
              aria-expanded={showAdvancedTiers}
            >
              {showAdvancedTiers ? "Hide trade tiers" : "Advanced market tiers"}
            </button>
            {showAdvancedTiers
              ? ADVANCED_TIERS.map((tier) => (
                  <button
                    key={tier.code}
                    type="button"
                    onClick={() => setActiveTier(tier.code)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors",
                      activeTier === tier.code
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-input text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {tier.label}
                  </button>
                ))
              : null}
          </>
        ) : (
          TIERS.filter((t) => t.code !== "public").map((tier) => (
            <button
              key={tier.code}
              type="button"
              onClick={() => setActiveTier(tier.code)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors",
                activeTier === tier.code
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-input text-muted-foreground hover:bg-muted",
              )}
            >
              {tier.label}
            </button>
          ))
        )}
      </div>

      {advancedTiersDisclosure && !showAdvancedTiers && activeTier !== "public" ? (
        <p className="text-xs text-muted-foreground">
          Showing {TIERS.find((t) => t.code === activeTier)?.label ?? activeTier}
          . Open Advanced market tiers to switch.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="sticky left-0 z-10 bg-card px-4 py-3 font-medium">
                Room category
              </th>
              {SEASONS.map((season) => (
                <th key={season} className="min-w-[8.5rem] px-3 py-3 font-medium">
                  <span className="block">{season}</span>
                  {formatSeasonDates(seasons, season) ? (
                    <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                      {formatSeasonDates(seasons, season)}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guestRooms.map((rt) => (
              <tr key={rt.id} className="border-b last:border-0">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5 align-middle">
                  <span className="font-medium text-foreground">{rt.name}</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {rt.code}
                  </span>
                </td>
                {SEASONS.map((season) => {
                  const key = cellKey(rt.id, season, activeTier);
                  const saved = savedByKey.get(key);
                  const draft = getDraft(rt.id, season, activeTier);
                  const isDirty =
                    draftByKey.has(key) &&
                    (draft.trim() === "" ? 0 : Number(draft)) !== (saved ?? 0);

                  return (
                    <td key={season} className="px-3 py-2 align-middle">
                      <label className="sr-only" htmlFor={key}>
                        {rt.name} {season} {activeTier}
                      </label>
                      <div className="flex items-stretch">
                        <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-2 text-xs text-muted-foreground">
                          Nu
                        </span>
                        <input
                          id={key}
                          type="number"
                          inputMode="numeric"
                          step="0.01"
                          min={0}
                          value={draft}
                          onChange={(e) =>
                            setDraft(rt.id, season, activeTier, e.target.value)
                          }
                          placeholder="—"
                          className={cn(
                            "w-full min-w-[5.5rem] rounded-r-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                            isDirty && "border-amber-500/70 bg-amber-50/40 dark:bg-amber-950/20",
                          )}
                        />
                      </div>
                      {(() => {
                        const adultNum =
                          draft.trim() === ""
                            ? (saved ?? 0)
                            : Number(draft);
                        if (!Number.isFinite(adultNum) || adultNum <= 0) {
                          return saved != null && saved > 0 && !isDirty ? (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatBtn(saved)}/night adult
                            </p>
                          ) : null;
                        }
                        const childHalf = childRateFromAdult(adultNum);
                        return (
                          <div className="mt-1 space-y-0.5 text-[10px] leading-snug text-muted-foreground">
                            <p className="tabular-nums text-foreground/80">
                              Adult {formatBtn(adultNum)}
                            </p>
                            <p className="tabular-nums">
                              6–12 {formatBtn(childHalf)}{" "}
                              <span className="text-muted-foreground">
                                (50%)
                              </span>
                            </p>
                            <p>0–6 free</p>
                          </div>
                        );
                      })()}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={action} className="flex flex-wrap items-center gap-3">
        <input
          type="hidden"
          name="rates_json"
          value={JSON.stringify(dirtyCells)}
          readOnly
        />
        <button
          type="submit"
          disabled={pending || dirtyCells.length === 0}
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending
            ? "Saving…"
            : dirtyCells.length > 0
              ? `Save ${dirtyCells.length} change${dirtyCells.length === 1 ? "" : "s"}`
              : "No changes"}
        </button>
        {state?.ok ? (
          <span className="text-sm text-muted-foreground">{state.message}</span>
        ) : state?.error ? (
          <span className="text-sm text-destructive">{state.error}</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Tab between cells · edit inline · save batch when ready
          </span>
        )}
      </form>
    </div>
  );
}
