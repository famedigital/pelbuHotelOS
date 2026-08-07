import "server-only";
import type { PeriodGuardOptions } from "@/lib/accounting/period-guard";
import {
  guestRateAdjDescriptionForStream,
  type BillLineGroup,
  classifyBillLine,
} from "@/lib/folio/bill-kinds";
import { netFolioBalance } from "@/lib/folio/balance";
import { postFolioCharge } from "@/lib/folio/post-charge";
import {
  GUEST_RATE_ADJ_DESCRIPTION,
  guestRateAbsorbBtn,
  isGuestRateAdjDescription,
  roundBtn,
  roundGuestWholeBtn,
} from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export { GUEST_RATE_ADJ_DESCRIPTION, isGuestRateAdjDescription };

type StreamKey = "room" | "fnb" | "other";

type FolioLineRow = {
  id: string;
  total_btn: number;
  status: string;
  source_type: string;
  reverses_line_id: string | null;
  description: string | null;
};

function streamForLine(line: FolioLineRow): StreamKey | "skip" {
  const st = (line.source_type ?? "").toLowerCase();
  if (st === "payment" || st === "deposit") return "skip";
  const group: BillLineGroup = classifyBillLine(line);
  if (group === "room") return "room";
  if (group === "fnb") return "fnb";
  // Hotel absorb already posted — leave in stream math via net balance of that stream only.
  if (group === "hotel_adj") {
    if (isGuestRateAdjDescription(line.description)) {
      const d = (line.description ?? "").toLowerCase();
      if (d.includes("room bill")) return "room";
      if (d.includes("f&b") || d.includes("fnb")) return "fnb";
      return "other";
    }
    return "other";
  }
  return "other";
}

async function postStreamAbsorb(
  admin: Admin,
  propertyId: string,
  args: {
    folioId: string;
    bookingId?: string | null;
    period_guard?: PeriodGuardOptions;
    stream: StreamKey;
    lines: FolioLineRow[];
  },
): Promise<{
  lineId: string | null;
  absorbBtn: number;
  chargesSumBtn: number;
  targetBtn: number;
}> {
  const sum = roundBtn(
    netFolioBalance(
      args.lines.map((l) => ({
        id: l.id,
        status: l.status,
        total_btn: Number(l.total_btn),
        reverses_line_id: l.reverses_line_id,
      })),
    ),
  );

  const targetBtn = roundGuestWholeBtn(Math.max(0, sum));
  const absorbBtn = guestRateAbsorbBtn(Math.max(0, sum));

  if (absorbBtn >= -0.009) {
    return {
      lineId: null,
      absorbBtn: 0,
      chargesSumBtn: sum,
      targetBtn: sum,
    };
  }

  const streamLabel =
    args.stream === "room"
      ? "room"
      : args.stream === "fnb"
        ? "fnb"
        : "master";
  const description = guestRateAdjDescriptionForStream(
    streamLabel === "fnb" ? "fnb" : streamLabel === "room" ? "room" : "master",
  );

  const posted = args.lines.filter((l) => l.status === "posted");
  const existing = posted.find(
    (l) =>
      isGuestRateAdjDescription(l.description) &&
      (l.description ?? "").includes(
        args.stream === "room"
          ? "room bill"
          : args.stream === "fnb"
            ? "F&B bill"
            : "hotel absorbs (round",
      ) &&
      Math.abs(Number(l.total_btn) - absorbBtn) < 0.01,
  );
  if (existing) {
    return {
      lineId: existing.id,
      absorbBtn: Number(existing.total_btn),
      chargesSumBtn: sum,
      targetBtn,
    };
  }

  const result = await postFolioCharge(admin, propertyId, {
    folio_id: args.folioId,
    booking_id: args.bookingId ?? null,
    source_type: "adjustment",
    source_id: args.folioId,
    description,
    qty: 1,
    unit_price_btn: absorbBtn,
    amount_btn: absorbBtn,
    gst_applicable: false,
    gst_btn: 0,
    total_btn: absorbBtn,
    skip_guest_rate_adj: true,
    period_guard: args.period_guard,
  });

  return {
    lineId: result.lineId,
    absorbBtn,
    chargesSumBtn: sum,
    targetBtn,
  };
}

/**
 * Absorb leftover chetrums so Master / Room / F&B bill totals each land on a
 * whole Nu ending in 0 or 5 (hotel-funded rate adj per stream).
 */
export async function postOpenFolioGuestRateRoundAdj(
  admin: Admin,
  propertyId: string,
  args: {
    folioId: string;
    bookingId?: string | null;
    period_guard?: PeriodGuardOptions;
  },
): Promise<{
  lineId: string | null;
  absorbBtn: number;
  chargesSumBtn: number;
  targetBtn: number;
  streams: {
    stream: StreamKey;
    absorbBtn: number;
    chargesSumBtn: number;
    targetBtn: number;
    lineId: string | null;
  }[];
}> {
  const { data: lines, error } = await admin
    .from("folio_lines")
    .select(
      "id, total_btn, status, source_type, reverses_line_id, description",
    )
    .eq("folio_id", args.folioId);
  if (error) throw new Error("Could not load folio lines.");

  const all: FolioLineRow[] = (lines ?? []).map((l) => ({
    id: l.id as string,
    total_btn: Number(l.total_btn),
    status: l.status as string,
    source_type: (l.source_type as string) ?? "",
    reverses_line_id: (l.reverses_line_id as string | null) ?? null,
    description: (l.description as string | null) ?? null,
  }));

  const byStream: Record<StreamKey, FolioLineRow[]> = {
    room: [],
    fnb: [],
    other: [],
  };
  for (const line of all) {
    const s = streamForLine(line);
    if (s === "skip") continue;
    byStream[s].push(line);
  }

  const streams: {
    stream: StreamKey;
    absorbBtn: number;
    chargesSumBtn: number;
    targetBtn: number;
    lineId: string | null;
  }[] = [];

  let lastLineId: string | null = null;
  let totalAbsorb = 0;
  let totalCharges = 0;

  for (const stream of ["room", "fnb", "other"] as StreamKey[]) {
    if (byStream[stream].length === 0) continue;
    const posted = await postStreamAbsorb(admin, propertyId, {
      folioId: args.folioId,
      bookingId: args.bookingId,
      period_guard: args.period_guard,
      stream,
      lines: byStream[stream],
    });
    streams.push({
      stream,
      absorbBtn: posted.absorbBtn,
      chargesSumBtn: posted.chargesSumBtn,
      targetBtn: posted.targetBtn,
      lineId: posted.lineId,
    });
    if (posted.lineId) lastLineId = posted.lineId;
    totalAbsorb = roundBtn(totalAbsorb + posted.absorbBtn);
    totalCharges = roundBtn(totalCharges + posted.chargesSumBtn);
  }

  const masterTarget = roundGuestWholeBtn(Math.max(0, totalCharges + totalAbsorb));

  return {
    lineId: lastLineId,
    absorbBtn: totalAbsorb,
    chargesSumBtn: totalCharges,
    targetBtn: masterTarget,
    streams,
  };
}
