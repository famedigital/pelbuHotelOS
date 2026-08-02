import "server-only";
import type { PeriodGuardOptions } from "@/lib/accounting/period-guard";
import { assertOpenPeriodForDate } from "@/lib/accounting/period-guard";
import {
  postCompCredit,
  postFolioLine,
} from "@/lib/accounting/posting";
import type { PostingResult } from "@/lib/accounting/types";
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
  period_guard?: PeriodGuardOptions;
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
    ["room", "meal_plan", "cancel_fee", "no_show_fee"].includes(st) &&
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

  const { data: line, error } = await admin
    .from("folio_lines")
    .insert({
      folio_id: input.folio_id,
      booking_id: input.booking_id ?? null,
      source_type: input.source_type,
      source_id: input.source_id ?? null,
      description: input.description,
      qty: input.qty ?? 1,
      unit_price_btn: input.unit_price_btn,
      amount_btn: input.amount_btn,
      service_charge_rate: input.service_charge_rate ?? 0,
      service_charge_btn: input.service_charge_btn ?? 0,
      service_charge_applied: input.service_charge_applied ?? false,
      service_charge_reason: input.service_charge_reason ?? null,
      gst_applicable: input.gst_applicable ?? Number(input.gst_btn ?? 0) > 0,
      gst_btn: input.gst_btn ?? 0,
      total_btn: input.total_btn,
      status: "posted",
      is_comp: input.is_comp ?? false,
      business_date: input.business_date ?? null,
      room_unit_id: input.room_unit_id ?? null,
      bill_to: billTo,
    })
    .select("id, source_type, description, total_btn, gst_btn, created_at")
    .single();

  if (error || !line) {
    const code = error?.code ? ` [${error.code}]` : "";
    throw new Error(
      `${error?.message ?? "Could not post folio charge."}${code}`,
    );
  }

  let gl: PostingResult;
  if (input.is_comp || input.source_type === "comp") {
    gl = await postCompCredit(admin, propertyId, {
      id: line.id as string,
      description: line.description as string | null,
      total_btn: Number(line.total_btn),
      created_at: input.journal_date ?? (line.created_at as string),
      period_guard: input.period_guard,
    });
  } else {
    gl = await postFolioLine(admin, propertyId, {
      id: line.id as string,
      source_type: line.source_type as string,
      description: line.description as string | null,
      total_btn: Number(line.total_btn),
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
