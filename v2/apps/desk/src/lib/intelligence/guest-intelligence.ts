/**
 * Guest intelligence dossiers with minimum-data gate.
 */
import type { Stay } from "../front-office-store";
import {
  averageArrivalGapDays,
  buildOfferCues,
  buildOutlook,
  bumpMix,
  mixSorted,
  monthKey,
  monthLabel,
  nightsBetween,
  type MixRow,
  type OfferCues,
  type OutlookBlock,
} from "./outlook";

export type GuestIntelStaySlice = Pick<
  Stay,
  | "id"
  | "status"
  | "guestName"
  | "nationality"
  | "passportOrCid"
  | "agencyName"
  | "typeCode"
  | "mealPlan"
  | "checkIn"
  | "checkOut"
  | "nightlyNet"
  | "folioLines"
  | "stayFlags"
  | "notes"
>;

export type GuestMinDataResult =
  | { ok: true }
  | { ok: false; missing: string[] };

/** ≥2 checked-out stays OR (≥1 stay + passport/CID + nationality). */
export function guestMeetsMinData(
  stays: GuestIntelStaySlice[],
  passportOrCid: string,
  nationality: string,
): GuestMinDataResult {
  const live = stays.filter((s) => !["cancelled", "no_show"].includes(s.status));
  const checkedOut = live.filter((s) => s.status === "checked_out");
  if (checkedOut.length >= 2) return { ok: true };
  if (live.length >= 1) {
    const missing: string[] = [];
    if (!(passportOrCid || "").trim()) missing.push("passportOrCid");
    if (!(nationality || "").trim()) missing.push("nationality");
    if (missing.length === 0) return { ok: true };
    return { ok: false, missing };
  }
  return {
    ok: false,
    missing: ["stay", ...(passportOrCid.trim() ? [] : ["passportOrCid"]), ...(nationality.trim() ? [] : ["nationality"])],
  };
}

function stayRevenue(stay: GuestIntelStaySlice): { charged: number; paid: number } {
  const open = stay.folioLines.filter((l) => !l.voided && l.stream === "master");
  const charges = open.filter((l) => l.kind !== "payment");
  const payments = open.filter((l) => l.kind === "payment");
  const charged = charges.reduce((s, l) => s + l.totalAmount, 0);
  const paid = Math.abs(payments.reduce((s, l) => s + l.totalAmount, 0));
  const fallback =
    charged > 0
      ? charged
      : Math.round(nightsBetween(stay.checkIn, stay.checkOut) * stay.nightlyNet);
  return { charged: charged > 0 ? charged : fallback, paid };
}

function guestKey(s: GuestIntelStaySlice): string {
  const doc = (s.passportOrCid || "").trim().toUpperCase();
  if (doc && !/^PARTY:/i.test(doc) && !/^PENDING/i.test(doc)) return `doc:${doc}`;
  return `name:${s.guestName.trim().toLowerCase()}|${(s.nationality || "").trim().toLowerCase()}`;
}

export type GuestIntelligenceRow = {
  guestKey: string;
  guestName: string;
  nationality: string;
  passportOrCid: string;
  visits: number;
  roomNights: number;
  spend: number;
  paid: number;
  agents: string[];
  mealMix: MixRow[];
  roomMix: MixRow[];
  monthPattern: { key: string; label: string; nights: number; stays: number }[];
  avgGapDays: number | null;
  outlook: OutlookBlock;
  cues: OfferCues;
  gate: GuestMinDataResult;
};

export type GuestIntelligenceReport = {
  from: string;
  to: string;
  asOf: string;
  dossiers: GuestIntelligenceRow[];
  needMoreData: GuestIntelligenceRow[];
};

export function buildGuestIntelligence(input: {
  stays: GuestIntelStaySlice[];
  from: string;
  to: string;
  asOf?: string;
}): GuestIntelligenceReport {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const buckets = new Map<string, GuestIntelStaySlice[]>();

  for (const s of input.stays) {
    if (["cancelled", "no_show"].includes(s.status)) continue;
    const anchor = (s.checkOut || s.checkIn).slice(0, 10);
    if (anchor < input.from || anchor > input.to) continue;
    const key = guestKey(s);
    const list = buckets.get(key) ?? [];
    list.push(s);
    buckets.set(key, list);
  }

  const dossiers: GuestIntelligenceRow[] = [];
  const needMoreData: GuestIntelligenceRow[] = [];

  for (const [key, list] of buckets) {
    const sorted = [...list].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const lead = sorted[sorted.length - 1]!;
    const passport = sorted.map((s) => s.passportOrCid).find((p) => (p || "").trim()) ?? "";
    const nationality =
      sorted.map((s) => s.nationality).find((n) => (n || "").trim()) ?? "";
    const gate = guestMeetsMinData(sorted, passport, nationality);

    let roomNights = 0;
    let spend = 0;
    let paid = 0;
    const meal = new Map<string, MixRow>();
    const room = new Map<string, MixRow>();
    const months = new Map<string, { key: string; label: string; nights: number; stays: number }>();
    const nightByMonth = new Map<string, number>();
    const arrivals: string[] = [];
    const checkouts: string[] = [];
    const agents = new Set<string>();
    const flags: string[] = [];
    const notes: string[] = [];

    for (const s of sorted) {
      const nts = nightsBetween(s.checkIn, s.checkOut);
      const money = stayRevenue(s);
      roomNights += nts;
      spend += money.charged;
      paid += money.paid;
      arrivals.push(s.checkIn.slice(0, 10));
      checkouts.push((s.checkOut || s.checkIn).slice(0, 10));
      bumpMix(meal, s.mealPlan, nts, money.charged);
      bumpMix(room, String(s.typeCode), nts, money.charged);
      const mk = monthKey(s.checkIn);
      const m = months.get(mk) ?? { key: mk, label: monthLabel(mk), nights: 0, stays: 0 };
      m.nights += nts;
      m.stays += 1;
      months.set(mk, m);
      nightByMonth.set(mk, (nightByMonth.get(mk) ?? 0) + nts);
      if (s.agencyName?.trim()) agents.add(s.agencyName.trim());
      if (s.stayFlags) flags.push(...s.stayFlags);
      if (s.notes?.trim()) notes.push(s.notes.trim());
    }

    const mealMix = mixSorted(meal);
    const roomMix = mixSorted(room);
    const row: GuestIntelligenceRow = {
      guestKey: key,
      guestName: lead.guestName,
      nationality: nationality || "—",
      passportOrCid: passport || "—",
      visits: sorted.length,
      roomNights,
      spend,
      paid,
      agents: [...agents].sort(),
      mealMix,
      roomMix,
      monthPattern: [...months.values()].sort((a, b) => a.key.localeCompare(b.key)),
      avgGapDays: averageArrivalGapDays(arrivals),
      outlook: buildOutlook({
        arrivalDates: arrivals,
        checkoutDates: checkouts,
        nightByMonth,
        asOf,
      }),
      cues: buildOfferCues({
        mealMix,
        roomMix,
        stayFlags: flags,
        stayNotes: notes,
      }),
      gate,
    };

    if (gate.ok) dossiers.push(row);
    else needMoreData.push(row);
  }

  dossiers.sort((a, b) => b.roomNights - a.roomNights || b.spend - a.spend);
  needMoreData.sort((a, b) => b.visits - a.visits);

  return {
    from: input.from,
    to: input.to,
    asOf,
    dossiers,
    needMoreData,
  };
}

export function exportGuestIntelligenceCsv(rows: GuestIntelligenceRow[]): string[][] {
  return [
    [
      "Guest",
      "Nationality",
      "PassportCid",
      "Visits",
      "RoomNights",
      "Spend",
      "Agents",
      "PreferredMeal",
      "PreferredRoom",
      "NextLikelyArrival",
      "GateOk",
    ],
    ...rows.map((r) => [
      r.guestName,
      r.nationality,
      r.passportOrCid,
      String(r.visits),
      String(r.roomNights),
      String(Math.round(r.spend)),
      r.agents.join("; "),
      r.cues.preferredMealPlan ?? "",
      r.cues.preferredRoomType ?? "",
      r.outlook.nextLikelyArrival ?? "",
      r.gate.ok ? "yes" : "no",
    ]),
  ];
}
