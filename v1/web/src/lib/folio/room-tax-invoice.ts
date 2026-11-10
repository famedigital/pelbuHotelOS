import { lineBelongsOnBill } from "@/lib/folio/bill-kinds";
import { paperDocNo, type PaperDocKind } from "@/lib/hotel-doc-no";
import { mealPlanInclusions } from "@/lib/kitchen/covers";
import { isGuestRateAdjDescription, roundBtn } from "@/lib/pricing";

export type TaxInvoiceSourceLine = {
  id: string;
  description?: string | null;
  source_type?: string | null;
  qty?: number | null;
  unit_price_btn?: number | null;
  amount_btn?: number | null;
  service_charge_btn?: number | null;
  gst_btn?: number | null;
  total_btn: number;
  business_date?: string | null;
};

export type TaxInvoiceRow = {
  id: string;
  folioNo: string;
  description: string;
  arrival: string;
  departure: string;
  nights: number;
  rate: number;
  amount: number;
};

export type TaxInvoiceTotals = {
  rows: TaxInvoiceRow[];
  /** Sum of line amounts, before service charge and GST. */
  total: number;
  serviceCharge: number;
  discount: number;
  afterDiscount: number;
  gst: number;
  net: number;
};

/** True when money already received covers the master-bill total. */
export function receivedCoversMasterBill(masterTotal: number, received: number): boolean {
  if (!Number.isFinite(masterTotal) || masterTotal <= 0) return false;
  if (!Number.isFinite(received) || received < 0) return false;
  return received + 0.05 >= masterTotal;
}

function exact4(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 10000) / 10000;
}

export function slashDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${Number(day)}/${Number(month)}/${year}`;
}

function addDay(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function roomNo(description: string): string {
  return description.match(/\bRoom\s+(\d+[A-Za-z0-9-]*)/i)?.[1] ?? "";
}

function lineNet(line: TaxInvoiceSourceLine): number {
  if (line.amount_btn != null && Number.isFinite(Number(line.amount_btn))) {
    return Number(line.amount_btn);
  }
  const sc = Number(line.service_charge_btn ?? 0);
  const gst = Number(line.gst_btn ?? 0);
  return roundBtn(Number(line.total_btn) - sc - gst);
}

const MEAL_LABEL = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
} as const;

function stayNightCount(checkIn?: string | null, checkOut?: string | null): number {
  const start = checkIn?.slice(0, 10) ?? "";
  const end = checkOut?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 0;
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.round((to - from) / 86_400_000);
}

function splitExact(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const each = exact4(total / parts);
  const amounts = Array.from({ length: parts }, () => each);
  if (parts === 1) return amounts;
  const used = exact4(amounts.slice(0, -1).reduce((sum, n) => sum + n, 0));
  amounts[parts - 1] = exact4(total - used);
  return amounts;
}

function lineLabel(line: TaxInvoiceSourceLine, roomNames: Record<string, string>): string {
  const source = (line.source_type ?? "").toLowerCase();
  const description = (line.description ?? "").trim();
  const room = roomNo(description);
  if (source === "order" || source === "pos") return "POS BILL";
  if (source === "laundry") {
    const detail = description.replace(/^Laundry\s*·\s*/i, "").trim();
    return detail || "Laundry";
  }
  if (/extra\s*mattress/i.test(description)) return "Extra mattress";
  if (source === "extra_bed" || /extra\s*bed/i.test(description)) {
    return `Extra bed${room ? `-${room}` : ""}`;
  }
  if (source === "room" || room) {
    const breakfast = /breakfast included/i.test(description);
    if (/\bsingle\b/i.test(description)) {
      return `Single${room ? `-${room}` : ""}${breakfast ? " · breakfast included" : ""}`;
    }
    const named = room ? roomNames[room]?.trim() : "";
    const base =
      named ||
      description
        .replace(/\bRoom\s+\d+[A-Za-z0-9-]*/gi, "")
        .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, "")
        .replace(/[·\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() ||
      "Room";
    return `${base}${room ? `-${room}` : ""}`.replace(/\s+-/g, "-");
  }
  return (
    description
      .replace(/\s*·\s*guest pays later, not the agent\s*/gi, "")
      .replace(/\s*·\s*agent tab\s*/gi, "")
      .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, "")
      .replace(/\s*·\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Charge"
  );
}

type Draft = {
  id: string;
  description: string;
  room: string;
  rate: number;
  /** Net before service charge and GST. Package rows keep this so food can be added. */
  net: number;
  nights: number;
  start: string | null;
  end: string | null;
  serviceCharge: number;
  gst: number;
  folioNo: string;
  fold: "package" | "meal" | "keep";
  single: boolean;
  category: string;
};

function masterPackageLabel(input: {
  category: string;
  single: boolean;
  room: string;
  mealCode: string | null;
}): string {
  const meal = (input.mealCode ?? "").trim().toUpperCase();
  const withMeal = meal !== "" && meal !== "EP" && meal !== "RO" && meal !== "EPAI";
  const base = input.category.trim() || (input.single ? "Single" : "Room");
  if (input.room && withMeal) return `${base} ${meal}-${input.room}`;
  if (input.room) return `${base}-${input.room}`.replace(/\s+-/g, "-");
  return withMeal ? `${base} ${meal}` : base;
}

function splitWeighted(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((acc, weight) => acc + weight, 0) || 1;
  const shares = weights.map((weight) => exact4(total * (weight / sum)));
  if (shares.length === 1) return [exact4(total)];
  const used = exact4(shares.slice(0, -1).reduce((acc, share) => acc + share, 0));
  shares[shares.length - 1] = exact4(total - used);
  return shares;
}

/** One room line: category, room number, and the meal code when food is inside the rate. */
function foldMasterMeals(drafts: Draft[], mealCode: string): Draft[] {
  const meals = drafts.filter((row) => row.fold === "meal");
  if (meals.length === 0) return drafts;
  const packages = drafts.filter((row) => row.fold === "package");
  if (packages.length === 0) return drafts;
  const mealNet = exact4(meals.reduce((sum, row) => sum + row.net, 0));
  const shares = splitWeighted(
    mealNet,
    packages.map((row) => row.nights),
  );
  packages.forEach((row, index) => {
    row.net = exact4(row.net + (shares[index] ?? 0));
    row.rate = row.nights > 0 ? exact4(row.net / row.nights) : row.net;
    row.description = masterPackageLabel({
      category: row.category,
      single: row.single,
      room: row.room,
      mealCode,
    });
  });
  return drafts.filter((row) => row.fold !== "meal");
}

function linePaperNo(folioNo: string, bill: PaperDocKind, source: string): string {
  if (!folioNo || folioNo === "—") return folioNo || "—";
  if (bill === "room" || bill === "fnb") return paperDocNo(folioNo, bill);
  if (source === "room" || source === "extra_bed") return paperDocNo(folioNo, "room");
  if (["meal_plan", "order", "pos"].includes(source)) return paperDocNo(folioNo, "fnb");
  return folioNo;
}

/**
 * Room tax invoice lines. Each row is one room, extra bed, or charge.
 * Printed amount is nights × rate, exact to 4 decimals. Service charge and GST stay in the footer.
 */
export function buildRoomTaxInvoice(
  lines: TaxInvoiceSourceLine[],
  options?: {
    mealPlanCode?: string | null;
    roomNames?: Record<string, string>;
    folioNo?: string | null;
    checkIn?: string | null;
    checkOut?: string | null;
    /** Room paper is rooms only. Food paper is the meal plan, plus POS as POS BILL. */
    bill?: "master" | "room" | "fnb";
  },
): TaxInvoiceTotals {
  const meal = options?.mealPlanCode ?? "";
  const roomNames = options?.roomNames ?? {};
  const folioNo = options?.folioNo?.trim() || "—";
  const bill = options?.bill ?? "master";
  const packageNights = stayNightCount(options?.checkIn, options?.checkOut);
  const packageStart = options?.checkIn?.slice(0, 10) || null;
  const packageEnd = options?.checkOut?.slice(0, 10) || null;
  const ordered = [...lines]
    .filter((line) => !isGuestRateAdjDescription(line.description))
    .sort((a, b) => {
      const aDay = a.business_date ?? "";
      const bDay = b.business_date ?? "";
      if (aDay !== bDay) return aDay.localeCompare(bDay);
      return a.id.localeCompare(b.id);
    });

  const drafts: Draft[] = [];
  let serviceCharge = 0;
  let gst = 0;

  for (const line of ordered) {
    const source = (line.source_type ?? "").toLowerCase();
    if (
      !lineBelongsOnBill(
        { source_type: source, description: line.description },
        bill,
      )
    ) {
      continue;
    }
    const mattress = /extra\s*mattress/i.test(line.description ?? "");
    const qty = Math.max(1, Number(line.qty) || 1);
    const net = lineNet(line);
    const nightly = !mattress && (source === "room" || source === "extra_bed");
    const factor = nightly ? 1 : qty;
    const unit =
      line.unit_price_btn != null && Number(line.unit_price_btn) > 0
        ? Number(line.unit_price_btn)
        : factor > 0
          ? net / factor
          : net;
    const rate = exact4(unit);
    const description = lineLabel(line, roomNames);
    const room = roomNo(line.description ?? "");
    const night = line.business_date?.slice(0, 10) || null;
    const sc = Number(line.service_charge_btn ?? 0);
    const lineGst = Number(line.gst_btn ?? 0);
    serviceCharge = exact4(serviceCharge + sc);
    gst = exact4(gst + lineGst);

    if (source === "meal_plan") {
      const nights = packageNights || 1;
      if (bill === "master") {
        drafts.push({
          id: line.id,
          description: "Meal",
          room: "",
          rate: exact4(net / nights),
          net,
          nights,
          start: packageStart || night,
          end: packageEnd || (packageStart || night ? addDay((packageStart || night) as string) : null),
          serviceCharge: sc,
          gst: lineGst,
          folioNo: linePaperNo(folioNo, bill, source),
          fold: "meal",
          single: false,
          category: "",
        });
        continue;
      }
      const included = mealPlanInclusions(meal);
      const labels = [
        included.breakfast ? MEAL_LABEL.breakfast : null,
        included.lunch ? MEAL_LABEL.lunch : null,
        included.dinner ? MEAL_LABEL.dinner : null,
      ].filter((label): label is "Breakfast" | "Lunch" | "Dinner" => label != null);
      const mealRows = labels.length ? labels : ["Meal"];
      const shares = splitExact(net, mealRows.length);
      mealRows.forEach((label, index) => {
        const share = shares[index] ?? 0;
        drafts.push({
          id: `${line.id}-${label}`,
          description: label,
          room: "",
          rate: exact4(share / nights),
          net: share,
          nights,
          start: packageStart || night,
          end: packageEnd || (packageStart || night ? addDay((packageStart || night) as string) : null),
          serviceCharge: 0,
          gst: 0,
          folioNo: linePaperNo(folioNo, bill, source),
          fold: "keep",
          single: false,
          category: "",
        });
      });
      continue;
    }

    const previous = nightly
      ? drafts.findLast(
          (row) =>
            row.room === room &&
            row.description === description &&
            Math.abs(row.rate - rate) < 0.00005 &&
            row.end === night,
        )
      : undefined;
    if (nightly && night && previous) {
      previous.nights += 1;
      previous.net = exact4(previous.net + net);
      previous.end = addDay(night);
      previous.serviceCharge = exact4(previous.serviceCharge + sc);
      previous.gst = exact4(previous.gst + lineGst);
      continue;
    }

    const packageRoom = nightly && source === "room";
    drafts.push({
      id: line.id,
      description,
      room,
      rate,
      net: packageRoom ? net : exact4(rate * factor),
      nights: factor,
      start: night,
      end: night ? (nightly ? addDay(night) : night) : null,
      serviceCharge: sc,
      gst: lineGst,
      folioNo: linePaperNo(folioNo, bill, source),
      fold: packageRoom ? "package" : "keep",
      single: /\bsingle\b/i.test(line.description ?? ""),
      category: room ? roomNames[room]?.trim() ?? "" : "",
    });
  }

  const folded = bill === "master" ? foldMasterMeals(drafts, meal) : drafts;
  if (bill === "master" && packageStart && packageEnd) {
    for (const row of folded) {
      if (row.fold !== "package") continue;
      row.start = packageStart;
      row.end = packageEnd;
    }
  }

  const rows: TaxInvoiceRow[] = folded.map((row) => {
    const amount =
      row.fold === "package" ? row.net : exact4(row.nights * row.rate);
    const rate =
      row.fold === "package" && row.nights > 0 ? exact4(row.net / row.nights) : row.rate;
    return {
      id: row.id,
      folioNo: row.folioNo,
      description: row.description,
      arrival: slashDate(row.start),
      departure: slashDate(row.end),
      nights: row.nights,
      rate,
      amount,
    };
  });

  const total = exact4(rows.reduce((sum, row) => sum + row.amount, 0));
  const discount = 0;
  const afterDiscount = exact4(total - discount);
  const net = exact4(afterDiscount + serviceCharge + gst);

  return {
    rows,
    total,
    serviceCharge,
    discount,
    afterDiscount,
    gst,
    net,
  };
}

/** Food paper when breakfast is inside the room rate and was not charged again. */
export function includedBreakfastOnFoodBill(
  lines: TaxInvoiceSourceLine[],
  options?: { folioNo?: string | null; checkIn?: string | null; checkOut?: string | null },
): TaxInvoiceTotals | null {
  const included = lines.filter(
    (line) =>
      (line.source_type ?? "").toLowerCase() === "room" &&
      /breakfast included/i.test(line.description ?? ""),
  );
  if (!included.length) return null;
  const dates = included
    .map((line) => line.business_date?.slice(0, 10) ?? "")
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .sort();
  const start = dates[0] || options?.checkIn?.slice(0, 10) || null;
  const last = dates[dates.length - 1] || null;
  const end = options?.checkOut?.slice(0, 10) || (last ? addDay(last) : null);
  return {
    rows: [
      {
        id: `${included[0]?.id ?? "breakfast"}-included`,
        folioNo: paperDocNo(options?.folioNo, "fnb"),
        description: "Breakfast included in single rate",
        arrival: slashDate(start),
        departure: slashDate(end),
        nights: dates.length || included.length,
        rate: 0,
        amount: 0,
      },
    ],
    total: 0,
    serviceCharge: 0,
    discount: 0,
    afterDiscount: 0,
    gst: 0,
    net: 0,
  };
}
