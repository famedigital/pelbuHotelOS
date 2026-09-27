import { mealPlanInclusions } from "@/lib/kitchen/covers";
import { roundBtn } from "@/lib/pricing";

export type PackageMealPeriod = "breakfast" | "lunch" | "dinner";

export type PublishedMenu = {
  serviceDate: string;
  mealPeriod: PackageMealPeriod;
  menuNote?: string | null;
  menuHighlights?: string | null;
};

export type FolioBillLine = {
  id: string;
  source_type: string;
  description?: string | null;
  total_btn: number;
  gst_btn?: number;
};

export type FoodBillDisplayLine = {
  id: string;
  source_type: string;
  description: string;
  hint: string | null;
  total_btn: number;
  gst_btn: number;
};

const PERIOD_LABEL: Record<PackageMealPeriod, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/** Stay nights: check-in inclusive, check-out exclusive. */
export function stayServiceDates(checkIn: string, checkOut: string): string[] {
  const start = checkIn.slice(0, 10);
  const end = checkOut.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return [];
  }
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return [];
  while (cursor < last && dates.length < 366) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function includedMealPeriods(planCode: string): PackageMealPeriod[] {
  const inc = mealPlanInclusions(planCode);
  const periods: PackageMealPeriod[] = [];
  if (inc.breakfast) periods.push("breakfast");
  if (inc.lunch) periods.push("lunch");
  if (inc.dinner) periods.push("dinner");
  return periods;
}

const STAY_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatStayDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  const monthLabel = STAY_MONTHS[Number(month) - 1];
  if (!year || !day || !monthLabel) return iso.slice(0, 10);
  return `${day} ${monthLabel} ${year}`;
}

function menuText(menu: PublishedMenu | undefined): string | null {
  if (!menu) return null;
  const parts = [menu.menuHighlights, menu.menuNote]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(" · ") : null;
}

/** Split a package amount across lines. The parts add back to the share. */
export function allocatePackageShare(totalBtn: number, parts: number): number[] {
  if (parts <= 0) return [];
  const total = roundBtn(totalBtn);
  if (parts === 1) return [total];
  const each = roundBtn(total / parts);
  const amounts = Array.from({ length: parts }, () => each);
  const used = roundBtn(amounts.slice(0, -1).reduce((sum, n) => sum + n, 0));
  amounts[amounts.length - 1] = roundBtn(total - used);
  return amounts;
}

/**
 * Food-bill rows for one stay. Package meals are one line per included meal
 * per night, with that day's published menu. Amounts split the meal share
 * already sold. They are not extra folio charges. POS lines stay as posted.
 */
export function presentFnbBillLines(args: {
  lines: FolioBillLine[];
  mealPlanCode: string | null | undefined;
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  menus?: PublishedMenu[];
}): FoodBillDisplayLine[] {
  const passthrough = (line: FolioBillLine): FoodBillDisplayLine => ({
    id: line.id,
    source_type: line.source_type,
    description: line.description?.trim() || "Charge",
    hint: null,
    total_btn: Number(line.total_btn) || 0,
    gst_btn: Number(line.gst_btn) || 0,
  });

  const mealLines = args.lines.filter(
    (line) => (line.source_type ?? "").toLowerCase() === "meal_plan",
  );
  const otherLines = args.lines.filter(
    (line) => (line.source_type ?? "").toLowerCase() !== "meal_plan",
  );

  const plan = (args.mealPlanCode ?? "").trim();
  const checkIn = args.checkIn?.slice(0, 10) ?? "";
  const checkOut = args.checkOut?.slice(0, 10) ?? "";
  const periods = plan ? includedMealPeriods(plan) : [];
  const dates =
    checkIn && checkOut ? stayServiceDates(checkIn, checkOut) : [];

  if (mealLines.length === 0 || periods.length === 0 || dates.length === 0) {
    return args.lines.map(passthrough);
  }

  const slots = dates.flatMap((serviceDate) =>
    periods.map((period) => ({ serviceDate, period })),
  );
  const mealShare = roundBtn(
    mealLines.reduce((sum, line) => sum + Number(line.total_btn || 0), 0),
  );
  const amounts = allocatePackageShare(mealShare, slots.length);
  const menus = args.menus ?? [];

  const packageLines: FoodBillDisplayLine[] = slots.map((slot, index) => {
    const menu = menus.find(
      (row) =>
        row.serviceDate.slice(0, 10) === slot.serviceDate &&
        row.mealPeriod === slot.period,
    );
    return {
      id: `${mealLines[0]?.id ?? "meal"}-${slot.serviceDate}-${slot.period}`,
      source_type: "meal_plan",
      description: `${formatStayDate(slot.serviceDate)} · ${PERIOD_LABEL[slot.period]} · package`,
      hint: menuText(menu),
      total_btn: amounts[index] ?? 0,
      gst_btn: 0,
    };
  });

  return [...packageLines, ...otherLines.map(passthrough)];
}
