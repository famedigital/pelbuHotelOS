import {
  CHILD_PACKAGE,
  effectiveChildNightRate,
} from "@/lib/child-packages";
import { roundBtn } from "@/lib/pricing";
import type { SeasonKind } from "@/lib/rates";

/** Default adults for double-occupancy meal package quotes. */
export const PACKAGE_OCCUPANCY_ADULTS = 2;

export type PackageMealInput = {
  code: string;
  name: string;
  blurb?: string | null;
  amount_btn_per_adult_night: number | null;
  amount_btn_per_child_night?: number | null;
};

export type PackageRateInputRoom = {
  id: string;
  code: string;
  name: string;
  /** season → room-only Nu for public BAR */
  amounts: Partial<Record<SeasonKind, number>>;
};

export type PackageColumn = {
  id: string;
  code: string;
  label: string;
  shortLabel: string;
  /** True when this is room-only (no meal money). */
  isRoomOnly: boolean;
  amountPerAdultNight: number | null;
  amountPerChildNight: number | null;
};

export type PackageCell = {
  columnId: string;
  totalBtn: number | null;
  roomBtn: number | null;
  mealAdultsBtn: number | null;
  childMealBtn: number | null;
};

export type PackageRoomRow = {
  id: string;
  code: string;
  name: string;
  /** season → package cells */
  bySeason: Partial<Record<SeasonKind, PackageCell[]>>;
};

export type PackageRateCard = {
  columns: PackageColumn[];
  rooms: PackageRoomRow[];
  occupancyAdults: number;
  childNote: string;
};

/**
 * Build package columns: Room only + one column per priced meal plan
 * (adult night rate > 0). EP/zero meals stay as Room only only.
 */
export function buildPackageColumns(
  mealPlans: PackageMealInput[],
): PackageColumn[] {
  const columns: PackageColumn[] = [
    {
      id: "room_only",
      code: "EP",
      label: "Room only",
      shortLabel: "Room",
      isRoomOnly: true,
      amountPerAdultNight: 0,
      amountPerChildNight: 0,
    },
  ];

  for (const plan of mealPlans) {
    const adult = plan.amount_btn_per_adult_night;
    if (adult == null || !(Number(adult) > 0)) continue;
    // Skip EP-style zero — Room only already covers that.
    if (plan.code.toUpperCase() === "EP" && Number(adult) === 0) continue;

    columns.push({
      id: `meal_${plan.code}`,
      code: plan.code,
      label: plan.name,
      shortLabel: plan.code,
      isRoomOnly: false,
      amountPerAdultNight: Number(adult),
      amountPerChildNight:
        plan.amount_btn_per_child_night == null
          ? null
          : Number(plan.amount_btn_per_child_night),
    });
  }

  return columns;
}

/** Package total: room night + meal adult rate × double occupancy. */
export function packageNightTotalBtn(
  roomBtn: number | null | undefined,
  amountPerAdultNight: number | null | undefined,
  occupancyAdults: number = PACKAGE_OCCUPANCY_ADULTS,
): number | null {
  if (roomBtn == null || !Number.isFinite(Number(roomBtn))) return null;
  const room = Number(roomBtn);
  const meal =
    amountPerAdultNight != null && Number(amountPerAdultNight) > 0
      ? Number(amountPerAdultNight) * Math.max(1, occupancyAdults)
      : 0;
  return roundBtn(room + meal);
}

export function buildPackageRateCard(args: {
  rooms: PackageRateInputRoom[];
  mealPlans: PackageMealInput[];
  seasons?: SeasonKind[];
  occupancyAdults?: number;
}): PackageRateCard {
  const seasons = args.seasons ?? (["peak", "lean", "off"] as SeasonKind[]);
  const occupancyAdults = args.occupancyAdults ?? PACKAGE_OCCUPANCY_ADULTS;
  const columns = buildPackageColumns(args.mealPlans);

  const rooms: PackageRoomRow[] = args.rooms.map((room) => {
    const bySeason: PackageRoomRow["bySeason"] = {};
    for (const season of seasons) {
      const roomBtn = room.amounts[season];
      if (roomBtn == null && roomBtn !== 0) {
        // still emit cells so UI shows —
      }
      const cells: PackageCell[] = columns.map((col) => {
        const roomVal =
          roomBtn != null && Number.isFinite(Number(roomBtn))
            ? Number(roomBtn)
            : null;
        if (col.isRoomOnly) {
          return {
            columnId: col.id,
            totalBtn: roomVal,
            roomBtn: roomVal,
            mealAdultsBtn: 0,
            childMealBtn: 0,
          };
        }
        const mealAdult = col.amountPerAdultNight ?? 0;
        const mealAdultsTotal =
          mealAdult > 0 ? roundBtn(mealAdult * occupancyAdults) : 0;
        const childOne = effectiveChildNightRate(
          col.amountPerAdultNight,
          col.amountPerChildNight,
        );
        const total =
          roomVal == null
            ? null
            : packageNightTotalBtn(
                roomVal,
                col.amountPerAdultNight,
                occupancyAdults,
              );
        return {
          columnId: col.id,
          totalBtn: total,
          roomBtn: roomVal,
          mealAdultsBtn: mealAdultsTotal,
          childMealBtn: childOne,
        };
      });
      bySeason[season] = cells;
    }
    return {
      id: room.id,
      code: room.code,
      name: room.name,
      bySeason,
    };
  });

  return {
    columns,
    rooms,
    occupancyAdults,
    childNote: `Ages 0–${CHILD_PACKAGE.freeUnderYears - 1} free. Ages ${CHILD_PACKAGE.freeUnderYears}–${CHILD_PACKAGE.halfUnderYears - 1}: child meal @ 50% of adult meal (not half the room).`,
  };
}

/**
 * From raw matrix rows (public tier) + room types, build package card inputs.
 */
export function roomsFromPublicRates(
  roomTypes: { id: string; code: string; name: string }[],
  rateRows: {
    room_type_id: string;
    season_kind: string;
    rate_tier: string;
    amount_btn: number;
  }[],
): PackageRateInputRoom[] {
  const publicRates = rateRows.filter((r) => r.rate_tier === "public");
  return roomTypes.map((rt) => {
    const amounts: Partial<Record<SeasonKind, number>> = {};
    for (const r of publicRates) {
      if (r.room_type_id !== rt.id) continue;
      const sk = r.season_kind as SeasonKind;
      if (sk === "peak" || sk === "lean" || sk === "off") {
        amounts[sk] = Number(r.amount_btn);
      }
    }
    return {
      id: rt.id,
      code: rt.code,
      name: rt.name,
      amounts,
    };
  });
}
