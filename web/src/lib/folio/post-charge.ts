import "server-only";
import { randomUUID } from "crypto";
import type { PeriodGuardOptions } from "@/lib/accounting/period-guard";
import { assertOpenPeriodForDate } from "@/lib/accounting/period-guard";
import {
  postCompCredit,
  postFolioLine,
} from "@/lib/accounting/posting";
import type { PostingResult } from "@/lib/accounting/types";
import {
  guestRateAbsorbBtn,
} from "@/lib/pricing";
import { guestRateAdjDescriptionForStream } from "@/lib/folio/bill-kinds";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export { allocateSplitGst } from "@/lib/folio/split-gst";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type FolioBillTo = "agent" | "guest";

export type FolioChargeInput = {
  folio_id: string;
  booking_id?: string | null;
  source_type: string;
  source_id?: string | null;
  description: string;
  qty?: number;
  unit_price_btn: number;
  amount_btn: number;
  service_charge_rate?: number;
  service_charge_btn?: number;
  service_charge_applied?: boolean;
  service_charge_reason?: string | null;
  gst_applicable?: boolean;
  gst_btn?: number;
  total_btn: number;
  is_comp?: boolean;
  business_date?: string | null;
  room_unit_id?: string | null;
  /** Who settles: agent room bucket vs guest extras (default from source). */
  bill_to?: FolioBillTo;
  /** Journal date override (YYYY-MM-DD or ISO). */
  journal_date?: string | null;
  /**
   * inclusive = quoted rate still includes GST.
   * net = amount is already GST-removed; do not strip 5% again.
   */
  tax_treatment?: "inclusive" | "net" | null;
  period_guard?: PeriodGuardOptions;
  /**
   * Skip auto whole-Nu rate absorb (used for the rate-adj line itself).
   * Default: auto-adj on positive fractional charges.
   */
  skip_guest_rate_adj?: boolean;
  /**
   * Client- or job-supplied UUID. Required for desk double-click safety;
   * when omitted, a new UUID is generated (system jobs should pass a stable key).
   */
  idempotency_key?: string | null;
};

/** Default payor for a charge source when caller does not set bill_to. */
export function defaultBillTo(
  sourceType: string,
  opts?: { hasAgent?: boolean; paymentMode?: string | null },
): FolioBillTo {
  const st = (sourceType ?? "").toLowerCase();
  const agentModes = new Set([
    "on_credit",
    "prepaid",
    "partial",
    "agent_credit",
  ]);
  const agentish =
    Boolean(opts?.hasAgent) &&
    agentModes.has((opts?.paymentMode ?? "").toLowerCase());
  if (
    ["room", "meal_plan", "extra_bed", "cancel_fee", "no_show_fee"].includes(
      st,
    ) &&
    agentish
  ) {
    return "agent";
  }
  return "guest";
}

export type FolioChargeResult = {
  ok: true;
  lineId: string;
  source_type: string;
  description: string | null;
  total_btn: number;
  gst_btn: number;
  created_at: string;
};

/**
 * Insert a posted folio charge line and journal it.
 * Rolls back (deletes the line) if GL posting fails.
 */
function chargeBusinessDate(input: FolioChargeInput): string {
  if (input.journal_date) return input.journal_date.slice(0, 10);
  if (input.business_date) return input.business_date;
  return new Date().toISOString().slice(0, 10);
}

export async function postFolioCharge(
  admin: Admin,
  propertyId: string,
  input: FolioChargeInput,
): Promise<FolioChargeResult> {
  await assertOpenPeriodForDate(admin, propertyId, chargeBusinessDate(input), {
    propertyId,
    ...input.period_guard,
  });

  let billTo = input.bill_to;
  if (!billTo) {
    let hasAgent = false;
    let paymentMode: string | null = null;
    if (input.booking_id) {
      const { data: booking } = await admin
        .from("bookings")
        .select("agent_id, payment_mode")
        .eq("id", input.booking_id)
        .maybeSingle();
      hasAgent = Boolean(booking?.agent_id);
      paymentMode = (booking?.payment_mode as string | null) ?? null;
    }
    billTo = defaultBillTo(input.source_type, { hasAgent, paymentMode });
  }

  const idempotencyKey =
    (input.idempotency_key?.trim() || randomUUID()).toLowerCase();

  const { data: rpcRaw, error: rpcError } = await admin.rpc(
    "post_folio_charge_atomic",
    {
      p_property_id: propertyId,
      p_folio_id: input.folio_id,
      p_idempotency_key: idempotencyKey,
      p_booking_id: input.booking_id ?? null,
      p_source_type: input.source_type,
      p_source_id: input.source_id ?? null,
      p_description: input.description,
      p_qty: input.qty ?? 1,
      p_unit_price_btn: input.unit_price_btn,
      p_amount_btn: input.amount_btn,
      p_gst_applicable: input.gst_applicable ?? Number(input.gst_btn ?? 0) > 0,
      p_gst_btn: input.gst_btn ?? 0,
      p_total_btn: input.total_btn,
      p_is_comp: input.is_comp ?? false,
      p_business_date: input.business_date ?? null,
      p_room_unit_id: input.room_unit_id ?? null,
      p_bill_to: billTo,
      p_tax_treatment: input.tax_treatment ?? null,
      p_service_charge_rate: input.service_charge_rate ?? 0,
      p_service_charge_btn: input.service_charge_btn ?? 0,
      p_service_charge_applied: input.service_charge_applied ?? false,
      p_service_charge_reason: input.service_charge_reason ?? null,
    },
  );

  if (rpcError) {
    const code = rpcError.code ? ` [${rpcError.code}]` : "";
    throw new Error(
      `${rpcError.message ?? "Could not post folio charge."}${code}`,
    );
  }

  const rpc = (rpcRaw ?? {}) as {
    ok?: boolean;
    line_id?: string;
    source_type?: string;
    description?: string | null;
    total_btn?: number;
    gst_btn?: number;
    created_at?: string;
    already_exists?: boolean;
  };

  if (!rpc.line_id) {
    throw new Error("Could not post folio charge (empty RPC result).");
  }

  const line = {
    id: rpc.line_id,
    source_type: rpc.source_type ?? input.source_type,
    description: rpc.description ?? input.description,
    total_btn: Number(rpc.total_btn ?? input.total_btn),
    gst_btn: Number(rpc.gst_btn ?? input.gst_btn ?? 0),
    created_at: rpc.created_at ?? new Date().toISOString(),
  };

  // Replay: line already journaled on first success — skip GL.
  if (rpc.already_exists) {
    return {
      ok: true,
      lineId: line.id,
      source_type: line.source_type,
      description: line.description,
      total_btn: Number(line.total_btn),
      gst_btn: Number(line.gst_btn),
      created_at: line.created_at,
    };
  }

  let gl: PostingResult;
  const totalPosted = Number(line.total_btn);
  // Guest credits (rate round figure absorb, comps) journal via abs + allowance rules.
  // Sales folio_line posts reject non-positive amounts.
  if (
    input.is_comp ||
    input.source_type === "comp" ||
    totalPosted < 0
  ) {
    gl = await postCompCredit(admin, propertyId, {
      id: line.id as string,
      description: line.description as string | null,
      total_btn: totalPosted,
      created_at: input.journal_date ?? (line.created_at as string),
      period_guard: input.period_guard,
    });
  } else {
    gl = await postFolioLine(admin, propertyId, {
      id: line.id as string,
      source_type: line.source_type as string,
      description: line.description as string | null,
      total_btn: totalPosted,
      gst_btn: Number(line.gst_btn),
      created_at: input.journal_date ?? (line.created_at as string),
      bill_to: billTo,
      period_guard: input.period_guard,
    });
  }

  if (!gl.ok) {
    await admin.from("folio_lines").delete().eq("id", line.id);
    throw new Error(gl.error ?? "Could not post charge to ledger.");
  }

  const skipAdj =
    input.skip_guest_rate_adj ||
    totalPosted <= 0 ||
    input.is_comp ||
    input.source_type === "comp" ||
    input.source_type === "payment" ||
    input.source_type === "deposit" ||
    input.source_type === "adjustment";

  if (!skipAdj) {
    await tryPostGuestRateRoundAdj(admin, propertyId, {
      folioId: input.folio_id,
      bookingId: input.booking_id ?? null,
      chargeLineId: line.id as string,
      chargeTotalBtn: totalPosted,
      chargeSourceType: input.source_type,
      billTo,
      journalDate: input.journal_date ?? (line.created_at as string),
      periodGuard: input.period_guard,
    });
  }

  return {
    ok: true,
    lineId: line.id as string,
    source_type: line.source_type as string,
    description: line.description as string | null,
    total_btn: Number(line.total_btn),
    gst_btn: Number(line.gst_btn),
    created_at: line.created_at as string,
  };
}

/**
 * Hotel-funded whole-Nu absorb line after a sellable charge.
 * Never throws — charge already succeeded; guest balance still gets the credit
 * even if GL rule is missing for pennies.
 */
async function tryPostGuestRateRoundAdj(
  admin: Admin,
  propertyId: string,
  args: {
    folioId: string;
    bookingId: string | null;
    chargeLineId: string;
    chargeTotalBtn: number;
    chargeSourceType: string;
    billTo: FolioBillTo;
    journalDate: string;
    periodGuard?: PeriodGuardOptions;
  },
): Promise<void> {
  const absorbBtn = guestRateAbsorbBtn(args.chargeTotalBtn);
  // Credit only (guest never pays up); skip if already whole Nu ending 0 or 5.
  if (!(absorbBtn < -0.009)) return;

  const creditAmt = Math.abs(absorbBtn); // positive Nu for GL (always > 0.009)
  if (!(creditAmt > 0.009)) return;

  const st = (args.chargeSourceType ?? "").toLowerCase();
  const stream =
    ["room", "extra_bed"].includes(st)
      ? ("room" as const)
      : ["meal_plan", "order", "pos"].includes(st)
        ? ("fnb" as const)
        : ("master" as const);
  const adjDescription = guestRateAdjDescriptionForStream(stream);

  const { data: adjLine, error: adjInsertError } = await admin
    .from("folio_lines")
    .insert({
      folio_id: args.folioId,
      booking_id: args.bookingId,
      source_type: "adjustment",
      source_id: args.chargeLineId,
      description: adjDescription,
      qty: 1,
      unit_price_btn: -creditAmt,
      amount_btn: -creditAmt,
      service_charge_rate: 0,
      service_charge_btn: 0,
      service_charge_applied: false,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: -creditAmt,
      status: "posted",
      is_comp: false,
      bill_to: args.billTo,
    })
    .select("id, total_btn, created_at")
    .single();

  if (adjInsertError || !adjLine) {
    console.error(
      "rate round adj folio insert failed",
      adjInsertError?.message ?? "no row",
    );
    return;
  }

  // Allowance journal: abs amount + folio_line.comp rules (deb expense / credit AR).
  const glAdj = await postCompCredit(admin, propertyId, {
    id: adjLine.id as string,
    description: adjDescription,
    total_btn: -creditAmt,
    created_at: args.journalDate,
    period_guard: args.periodGuard,
  });

  if (!glAdj.ok) {
    // Keep guest-facing credit even if GL posting rule is missing — do not fail charge.
    console.error(
      "rate round adj GL failed (folio credit kept)",
      glAdj.error,
      { lineId: adjLine.id, creditAmt },
    );
  }
}
