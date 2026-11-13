/** Shared rule-based outlook helpers for Intelligence suite (no ML). */

export function daysBetweenIso(a: string, b: string): number {
  const x = Date.parse(`${a.slice(0, 10)}T12:00:00`);
  const y = Date.parse(`${b.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return Math.round((y - x) / 86_400_000);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const n = daysBetweenIso(checkIn, checkOut);
  return n > 0 ? n : 1;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  if (!y || !m) return key;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

export type MixRow = {
  key: string;
  label: string;
  count: number;
  nights: number;
  amount: number;
};

export function bumpMix(
  map: Map<string, MixRow>,
  key: string,
  nights: number,
  amount: number,
  label = key,
): void {
  const row = map.get(key) ?? { key, label, count: 0, nights: 0, amount: 0 };
  row.count += 1;
  row.nights += nights;
  row.amount += amount;
  map.set(key, row);
}

export function mixSorted(map: Map<string, MixRow>): MixRow[] {
  return [...map.values()].sort((a, b) => b.nights - a.nights || b.amount - a.amount);
}

/** Average gap (days) between sorted arrival dates. */
export function averageArrivalGapDays(arrivalDates: string[]): number | null {
  const sorted = [...new Set(arrivalDates.map((d) => d.slice(0, 10)))].sort();
  if (sorted.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetweenIso(sorted[i - 1]!, sorted[i]!));
  }
  const sum = gaps.reduce((n, g) => n + g, 0);
  return Math.round(sum / gaps.length);
}

export type OutlookBlock = {
  lastCheckout: string | null;
  medianGapDays: number | null;
  nextLikelyArrival: string | null;
  projectedNights90d: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
};

/**
 * Next arrival ≈ last checkout + median inter-arrival gap.
 * Projected 90d nights = historical monthly share applied to trailing annual nights / 4.
 */
export function buildOutlook(input: {
  arrivalDates: string[];
  checkoutDates: string[];
  nightByMonth: Map<string, number>;
  asOf?: string;
}): OutlookBlock {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const arrivals = [...input.arrivalDates].map((d) => d.slice(0, 10)).sort();
  const checkouts = [...input.checkoutDates].map((d) => d.slice(0, 10)).sort();
  const lastCheckout = checkouts[checkouts.length - 1] ?? null;
  const gaps: number[] = [];
  for (let i = 1; i < arrivals.length; i++) {
    gaps.push(daysBetweenIso(arrivals[i - 1]!, arrivals[i]!));
  }
  const gap = median(gaps);
  let nextLikelyArrival: string | null = null;
  if (lastCheckout && gap != null && gap > 0) {
    nextLikelyArrival = addDaysIso(lastCheckout, Math.round(gap));
    if (nextLikelyArrival < asOf) {
      nextLikelyArrival = addDaysIso(asOf, Math.max(7, Math.round(gap / 4)));
    }
  }

  const totalNights = [...input.nightByMonth.values()].reduce((n, v) => n + v, 0);
  const horizonMonths = [0, 1, 2].map((i) => {
    const d = new Date(`${asOf}T12:00:00`);
    d.setMonth(d.getMonth() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  let seasonalShare = 0;
  for (const mk of horizonMonths) {
    const histKey = [...input.nightByMonth.keys()].find((k) => k.endsWith(mk.slice(5)));
    if (histKey) seasonalShare += input.nightByMonth.get(histKey) ?? 0;
  }
  const yearTotal = totalNights || 1;
  const projectedNights90d =
    totalNights === 0
      ? 0
      : Math.round((seasonalShare / yearTotal) * totalNights * (90 / 365) * 4) ||
        Math.round(totalNights * (90 / Math.max(365, daysBetweenIso(arrivals[0] ?? asOf, asOf) || 365)));

  // Simpler projection: avg nights per stay × expected arrivals in 90d from gap
  const avgNightsPerTrip =
    arrivals.length > 0 ? totalNights / arrivals.length : 0;
  const expectedTrips =
    gap != null && gap > 0 ? Math.max(0, Math.round(90 / gap)) : arrivals.length > 0 ? 1 : 0;
  const projected = Math.round(avgNightsPerTrip * expectedTrips);

  let confidence: OutlookBlock["confidence"] = "low";
  if (arrivals.length >= 5 && gap != null) confidence = "high";
  else if (arrivals.length >= 2 && gap != null) confidence = "medium";

  const rationale =
    gap == null
      ? "Need at least two arrivals to estimate return cadence."
      : `Median ${Math.round(gap)}d between arrivals · ~${expectedTrips} trip(s) in next 90d · ${Math.round(avgNightsPerTrip)}n/trip.`;

  return {
    lastCheckout,
    medianGapDays: gap == null ? null : Math.round(gap),
    nextLikelyArrival,
    projectedNights90d: projected,
    confidence,
    rationale,
  };
}

export type OfferCues = {
  preferredMealPlan: string | null;
  preferredRoomType: string | null;
  suggestedSingleNet: number | null;
  suggestedDoubleNet: number | null;
  amenities: string[];
  menuCues: string[];
  rateNote: string;
};

export function buildOfferCues(input: {
  mealMix: MixRow[];
  roomMix: MixRow[];
  singleNet?: number | null;
  doubleNet?: number | null;
  stayFlags: string[];
  stayNotes: string[];
}): OfferCues {
  const preferredMealPlan = input.mealMix[0]?.key ?? null;
  const preferredRoomType = input.roomMix[0]?.key ?? null;
  const amenities = [...new Set(input.stayFlags.map((f) => f.trim()).filter(Boolean))].slice(
    0,
    8,
  );
  const noteHints = input.stayNotes
    .map((n) => n.trim())
    .filter((n) => n.length > 3)
    .slice(0, 5);
  const menuCues: string[] = [];
  if (preferredMealPlan === "MAP" || preferredMealPlan === "AP") {
    menuCues.push("Keep breakfast + dinner quality consistent (MAP/AP guests).");
    menuCues.push("Offer set Bhutanese dinner + one international option.");
  } else if (preferredMealPlan === "CP") {
    menuCues.push("Strong breakfast programme; optional à-la-carte dinner upsell.");
  } else if (preferredMealPlan === "EP") {
    menuCues.push("Room-only — highlight restaurant / room-service menus on arrival.");
  }
  if (preferredRoomType?.includes("twin") || preferredRoomType?.includes("Twin")) {
    menuCues.push("Twin groups often share — portion / sharing platters work well.");
  }

  const rateNote =
    input.doubleNet != null
      ? `Lead with contracted double net Nu ${Math.round(input.doubleNet).toLocaleString("en-BT")}${
          preferredMealPlan ? ` · ${preferredMealPlan}` : ""
        }.`
      : preferredMealPlan
        ? `Anchor offers on preferred meal plan ${preferredMealPlan}.`
        : "Collect more stay history before locking a special rate.";

  return {
    preferredMealPlan,
    preferredRoomType,
    suggestedSingleNet: input.singleNet ?? null,
    suggestedDoubleNet: input.doubleNet ?? null,
    amenities: amenities.length > 0 ? amenities : noteHints.slice(0, 3),
    menuCues,
    rateNote,
  };
}
