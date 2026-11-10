/**
 * Build marketing rate-sheet documents from live `room_rates` matrix.
 * Source of truth is always Hotel → Room rates — never invent Nu.
 */

import {
  emptyRateSheetDocument,
  newBlockId,
  type RateSheetAudience,
  type RateSheetDocument,
  type RateSheetTableBlock,
} from "@/lib/marketing/rate-sheet";
import { formatBtn } from "@/lib/pricing";
import {
  buildPackageColumns,
  packageNightTotalBtn,
  type PackageMealInput,
} from "@/lib/rate-packages";
import type { RateTier, SeasonKind } from "@/lib/rates";

const SEASONS: SeasonKind[] = ["peak", "lean", "off"];

export type MatrixRoomType = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
};

export type MatrixRateCell = {
  room_type_id: string;
  season_kind: string;
  rate_tier: string;
  amount_btn: number | null;
  amount_single_btn: number | null;
};

export type MatrixSeasonWindow = {
  kind: string;
  starts_on: string;
  ends_on: string;
};

export type LiveRateSheetSpec = {
  slug: string;
  title: string;
  audience: RateSheetAudience;
  rateTier: RateTier;
  tierLabel: string;
};

/** Standard published cards from the rates matrix (beta: regenerate freely). */
export const LIVE_RATE_SHEET_SPECS: LiveRateSheetSpec[] = [
  {
    slug: "from-matrix-public",
    title: "Public / rack rates",
    audience: "public",
    rateTier: "public",
    tierLabel: "Public / rack",
  },
  {
    slug: "from-matrix-agents",
    title: "Agent partner rates",
    audience: "agents",
    rateTier: "agents",
    tierLabel: "Agents",
  },
  {
    slug: "from-matrix-mou-agents",
    title: "MOU agent rates",
    audience: "partners",
    rateTier: "mou_agents",
    tierLabel: "MOU agents",
  },
  {
    slug: "from-matrix-friends",
    title: "Friends rates",
    audience: "custom",
    rateTier: "friends",
    tierLabel: "Friends",
  },
  {
    slug: "from-matrix-family",
    title: "Family rates",
    audience: "custom",
    rateTier: "family",
    tierLabel: "Family",
  },
  {
    slug: "from-matrix-mutual-friends",
    title: "Mutual friends rates",
    audience: "custom",
    rateTier: "mutual_friends",
    tierLabel: "Mutual friends",
  },
];

function seasonDateHint(
  seasons: MatrixSeasonWindow[],
  kind: SeasonKind,
): string {
  const windows = seasons.filter((s) => s.kind === kind);
  if (windows.length === 0) return "";
  return windows
    .map((w) => `${w.starts_on.slice(5)} → ${w.ends_on.slice(5)}`)
    .join(", ");
}

function cellText(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  return formatBtn(Number(amount));
}

type RoomAmounts = {
  double: number | null;
  single: number | null;
};

function amountsFor(
  rates: MatrixRateCell[],
  roomTypeId: string,
  season: SeasonKind,
  tier: RateTier,
): RoomAmounts {
  const row = rates.find(
    (r) =>
      r.room_type_id === roomTypeId &&
      r.season_kind === season &&
      r.rate_tier === tier,
  );
  if (!row) return { double: null, single: null };
  const double =
    row.amount_btn != null && Number.isFinite(Number(row.amount_btn))
      ? Number(row.amount_btn)
      : null;
  const single =
    row.amount_single_btn != null &&
    Number.isFinite(Number(row.amount_single_btn))
      ? Number(row.amount_single_btn)
      : null;
  return { double, single };
}

function packageRow(
  roomName: string,
  occupancyLabel: string,
  roomBtn: number | null,
  mealPlans: PackageMealInput[],
  adults: number,
): string[] {
  const columns = buildPackageColumns(mealPlans);
  const cells = columns.map((col) => {
    if (col.isRoomOnly) return cellText(roomBtn);
    if (roomBtn == null) return "—";
    const total = packageNightTotalBtn(
      roomBtn,
      col.amountPerAdultNight,
      adults,
    );
    return cellText(total);
  });
  return [roomName, occupancyLabel, ...cells];
}

function seasonTable(args: {
  season: SeasonKind;
  seasonHint: string;
  roomTypes: MatrixRoomType[];
  rates: MatrixRateCell[];
  rateTier: RateTier;
  mealPlans: PackageMealInput[];
}): RateSheetTableBlock | null {
  const guestRooms = args.roomTypes.filter(
    (r) => r.inventory_kind === "sellable_guest",
  );
  if (guestRooms.length === 0) return null;

  const columns = buildPackageColumns(args.mealPlans);
  const headers = [
    "Room category",
    "Occupancy",
    ...columns.map((c) => c.shortLabel || c.code),
  ];
  const rows: string[][] = [];

  for (const rt of guestRooms) {
    const { double, single } = amountsFor(
      args.rates,
      rt.id,
      args.season,
      args.rateTier,
    );
    if (double == null && single == null) continue;

    if (single != null) {
      rows.push(
        packageRow(rt.name, "Single", single, args.mealPlans, 1),
      );
    }
    if (double != null) {
      rows.push(
        packageRow(rt.name, "Double", double, args.mealPlans, 2),
      );
    } else if (single == null) {
      // neither — already skipped
    } else {
      // single only row already added
    }
  }

  if (rows.length === 0) return null;

  const caption = args.seasonHint
    ? `${args.season} season (${args.seasonHint})`
    : `${args.season} season`;

  return {
    id: newBlockId(),
    type: "table",
    caption,
    headers,
    rows,
  };
}

/**
 * One marketing sheet for a rate tier, tables filled from `room_rates` + meal plans.
 */
export function buildRateSheetDocumentFromMatrix(args: {
  rateTier: RateTier;
  tierLabel: string;
  roomTypes: MatrixRoomType[];
  rates: MatrixRateCell[];
  seasons: MatrixSeasonWindow[];
  mealPlans: PackageMealInput[];
  inclusiveOfGstSc: boolean;
}): RateSheetDocument {
  const taxLine = args.inclusiveOfGstSc
    ? "Figures match Hotel → Room rates and are stored all-in (GST + SC included when policy applies)."
    : "Figures match Hotel → Room rates (room Nu may exclude GST/SC; package meal add-ons follow meal plan Nu).";

  const blocks: RateSheetDocument["blocks"] = [
    {
      id: newBlockId(),
      type: "heading",
      level: 1,
      text: `${args.tierLabel} rates`,
    },
    {
      id: newBlockId(),
      type: "banner",
      tone: "neutral",
      eyebrow: "Live from desk matrix",
      title: "Hotel → Room rates",
      body: `${taxLine} Single occupancy uses the single field when set; otherwise only double is listed. Refresh any time — beta overwrites these sheets.`,
    },
  ];

  let anyTable = false;
  for (const season of SEASONS) {
    const table = seasonTable({
      season,
      seasonHint: seasonDateHint(args.seasons, season),
      roomTypes: args.roomTypes,
      rates: args.rates,
      rateTier: args.rateTier,
      mealPlans: args.mealPlans,
    });
    if (table) {
      anyTable = true;
      blocks.push(table);
    }
  }

  if (!anyTable) {
    blocks.push({
      id: newBlockId(),
      type: "note",
      text: `No ${args.tierLabel} amounts in the matrix yet. Enter Nu under Hotel → Room rates (tier + season + single/double), then refresh rate sheets.`,
    });
  }

  blocks.push({
    id: newBlockId(),
    type: "cards",
    items: [
      {
        title: "EP / Room",
        body: "Room only for the occupancy shown.",
      },
      {
        title: "Meal plans",
        body: "CP / MAP etc. = room + meal plan × adults priced for that occupancy.",
      },
      {
        title: "NC / complimentary",
        body: "Not a rate tier. Book as non-chargeable at the desk — folio posts Nu 0.",
      },
    ],
  });

  blocks.push({
    id: newBlockId(),
    type: "note",
    text: "Canonical source: Hotel → Room rates. Special short promos use Marketing campaigns, not this matrix. Do not re-type Nu here for ops — regenerate from the matrix after updates.",
  });

  blocks.push({ id: newBlockId(), type: "property_contact" });

  return {
    version: 1,
    intro: `Generated from live room_rates (${args.tierLabel}). Edit copy if needed; Nu should be refreshed from Hotel → Room rates.`,
    blocks,
  };
}

export function seasonLabelFromWindows(seasons: MatrixSeasonWindow[]): string {
  if (seasons.length === 0) return "All seasons on property calendar";
  const kinds = new Set(seasons.map((s) => s.kind));
  return Array.from(kinds)
    .map((k) => {
      if (k === "peak" || k === "lean" || k === "off") {
        const hint = seasonDateHint(seasons, k);
        return hint ? `${k} ${hint}` : k;
      }
      return k;
    })
    .join(" · ");
}

export function emptyStubDocument(title: string): RateSheetDocument {
  const doc = emptyRateSheetDocument();
  doc.intro = title;
  doc.blocks = [
    {
      id: newBlockId(),
      type: "heading",
      level: 1,
      text: title,
    },
    {
      id: newBlockId(),
      type: "paragraph",
      text: "No matrix data yet.",
    },
  ];
  return doc;
}
