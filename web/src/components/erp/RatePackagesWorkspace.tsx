"use client";

import {
  MealPlansRatesSummary,
  type MealPlanSummaryRow,
} from "@/components/erp/MealPlansRatesSummary";
import { RoomRatesSheet } from "@/components/erp/RoomRatesSheet";
import { RatePackagesTable } from "@/components/rates/RatePackagesTable";
import {
  buildPackageRateCard,
  roomsFromPublicRates,
  type PackageMealInput,
} from "@/lib/rate-packages";
import type { SeasonKind } from "@/lib/rates";
import Link from "next/link";
import { useMemo } from "react";

/** Props shape — avoid importing server-only room-rates-data in this client module. */
export type RatesWorkspaceRoom = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
};

export type RatesWorkspaceRateRow = {
  id: string | null;
  room_type_id: string;
  room_type_name: string;
  season_kind: string;
  rate_tier: string;
  amount_btn: number;
  amount_single_btn: number | null;
};

export type RatesWorkspaceSeason = {
  id?: string;
  kind: string;
  starts_on: string;
  ends_on: string;
};

function asSeasonKind(value: string): SeasonKind | null {
  if (value === "peak" || value === "lean" || value === "off") return value;
  return null;
}

function resolveCurrentSeason(seasons: RatesWorkspaceSeason[]): SeasonKind {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  for (const s of seasons) {
    if (s.starts_on <= today && today <= s.ends_on) {
      const k = asSeasonKind(s.kind);
      if (k) return k;
    }
  }
  return "lean";
}

function seasonDateHint(seasons: RatesWorkspaceSeason[], kind: string): string {
  const windows = seasons.filter((s) => s.kind === kind);
  if (windows.length === 0) return "";
  return windows
    .map((w) => `${w.starts_on.slice(5)} → ${w.ends_on.slice(5)}`)
    .join(", ");
}

export function RatePackagesWorkspace({
  rows,
  roomTypes,
  seasons,
  mealPlans,
  defaultMealPlanCode,
  ratesInclusiveOfGstSc = false,
}: {
  rows: RatesWorkspaceRateRow[];
  roomTypes: RatesWorkspaceRoom[];
  seasons: RatesWorkspaceSeason[];
  mealPlans: MealPlanSummaryRow[];
  defaultMealPlanCode: string;
  ratesInclusiveOfGstSc?: boolean;
}) {
  const guestRooms = useMemo(
    () => roomTypes.filter((r) => r.inventory_kind === "sellable_guest"),
    [roomTypes],
  );

  const mealInputs: PackageMealInput[] = useMemo(
    () =>
      mealPlans
        .filter((p) => p.is_active)
        .map((p) => ({
          code: p.code,
          name: p.name,
          blurb: p.blurb,
          amount_btn_per_adult_night: p.amount_btn_per_adult_night,
          amount_btn_per_child_night: p.amount_btn_per_child_night,
        })),
    [mealPlans],
  );

  const packageCard = useMemo(() => {
    const rooms = roomsFromPublicRates(
      guestRooms.map((r) => ({ id: r.id, code: r.code, name: r.name })),
      rows.map((r) => ({
        room_type_id: r.room_type_id,
        season_kind: r.season_kind,
        rate_tier: r.rate_tier,
        amount_btn: r.amount_btn,
      })),
    ).filter((r) => Object.keys(r.amounts).length > 0);

    // Include rooms without rates so desk sees empty rows when needed
    const withMissing =
      rooms.length > 0
        ? rooms
        : guestRooms.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            amounts: {} as Partial<Record<SeasonKind, number>>,
          }));

    return buildPackageRateCard({
      rooms: withMissing,
      mealPlans: mealInputs,
    });
  }, [guestRooms, mealInputs, rows]);

  const currentSeasonKind = resolveCurrentSeason(seasons);
  const packageSeasons = (["peak", "lean", "off"] as SeasonKind[]).map(
    (kind) => ({
      kind,
      dateHint: seasonDateHint(seasons, kind) || null,
    }),
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Rate packages (public)
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Same package card used for desk quotes: room only plus meal
            packages at double occupancy (room + adult meal × 2). Edit public
            room Nu below to change these figures.
          </p>
        </header>
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <RatePackagesTable
            card={packageCard}
            seasons={packageSeasons}
            currentSeasonKind={currentSeasonKind}
            mode="desk-preview"
            taxInclusive={ratesInclusiveOfGstSc}
            emptyMessage="Add public tier Nu in the sheet below to populate packages."
          />
        </div>
      </section>

      <section className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Edit room Nu
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Primary sheet is{" "}
            <strong className="font-medium text-foreground">public / rack</strong>
            . Each season cell has <strong className="font-medium text-foreground">double</strong>{" "}
            (2 adults) and{" "}
            <strong className="font-medium text-foreground">single</strong>{" "}
            (1 adult) room-only Nu. Package totals above still use double for
            meal packages. Open Advanced market tiers for agents, MOU, friends,
            and family. Amounts are{" "}
            {ratesInclusiveOfGstSc
              ? "inclusive of GST and SC (when SC is on by default)"
              : "exclusive of GST and SC"}
            .
          </p>
        </header>
        <RoomRatesSheet
          rows={rows}
          roomTypes={roomTypes}
          seasons={seasons}
          ratesInclusiveOfGstSc={ratesInclusiveOfGstSc}
          defaultTier="public"
          advancedTiersDisclosure
        />
      </section>

      <section className="space-y-3">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Meal plans</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Adult Nu feeds package columns above (×2 for double occupancy).
              Child 6–12 meal is half the adult meal portion only.
            </p>
          </div>
          <Link
            href="/erp/settings?tab=commercial"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Edit in Settings →
          </Link>
        </header>
        <MealPlansRatesSummary
          mealPlans={mealPlans}
          defaultMealPlanCode={defaultMealPlanCode}
          compact
        />
      </section>
    </div>
  );
}
