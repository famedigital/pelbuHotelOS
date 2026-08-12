/**
 * Per-night rate grid (eZee Rate Information lite) for StayHub FO.
 * Builds tax lines from property GST / SC without writing folio posts.
 */

import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";
import type { RoomRateTaxSettings } from "@/lib/room-rate-tax";

export type StayNightRow = {
  /** YYYY-MM-DD stay-night (arrival + i). */
  date: string;
  dayLabel: string;
  baseBtn: number;
  discountBtn: number;
  taxableBtn: number;
  serviceBtn: number;
  gstBtn: number;
  totalBtn: number;
  adults: number;
  children: number;
};

export type StayNightGridInput = {
  checkIn: string;
  checkOut: string;
  /** Room night before tax (agreed or sheet). */
  baseNightBtn: number;
  adults: number;
  children: number;
  tax: RoomRateTaxSettings;
  /** Forced FO overrides */
  taxExemptGst?: boolean;
  taxExemptService?: boolean;
  rateTaxMode?: "inclusive" | "exclusive";
};

function eachStayNight(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (
    let d = new Date(start);
    d < end;
    d.setDate(d.getDate() + 1)
  ) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

function dayName(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

export function buildStayNightGrid(input: StayNightGridInput): {
  nights: StayNightRow[];
  totals: {
    baseBtn: number;
    discountBtn: number;
    serviceBtn: number;
    gstBtn: number;
    totalBtn: number;
  };
} {
  const dates = eachStayNight(input.checkIn, input.checkOut);
  const base = Math.max(0, Number(input.baseNightBtn) || 0);
  const tax: RoomRateTaxSettings = {
    ...input.tax,
    applyServiceCharge:
      input.taxExemptService === true ? false : input.tax.applyServiceCharge,
    gstRate: input.taxExemptGst === true ? 0 : input.tax.gstRate,
    inclusiveOfGstSc:
      input.rateTaxMode === "inclusive"
        ? true
        : input.rateTaxMode === "exclusive"
          ? false
          : input.tax.inclusiveOfGstSc,
  };

  const nights: StayNightRow[] = dates.map((date) => {
    const calc = calculateRoomNightTax(base, tax);
    return {
      date,
      dayLabel: dayName(date),
      baseBtn: roundBtn(base),
      discountBtn: 0,
      taxableBtn: calc.amountBtn,
      serviceBtn: calc.serviceChargeBtn,
      gstBtn: calc.gstBtn,
      totalBtn: calc.totalBtn,
      adults: input.adults,
      children: input.children,
    };
  });

  const totals = nights.reduce(
    (acc, n) => ({
      baseBtn: roundBtn(acc.baseBtn + n.baseBtn),
      discountBtn: roundBtn(acc.discountBtn + n.discountBtn),
      serviceBtn: roundBtn(acc.serviceBtn + n.serviceBtn),
      gstBtn: roundBtn(acc.gstBtn + n.gstBtn),
      totalBtn: roundBtn(acc.totalBtn + n.totalBtn),
    }),
    { baseBtn: 0, discountBtn: 0, serviceBtn: 0, gstBtn: 0, totalBtn: 0 },
  );

  return { nights, totals };
}
