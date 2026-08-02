import "server-only";
import { postSimpleEvent } from "@/lib/accounting/journals";
import type { PeriodGuardOptions } from "@/lib/accounting/period-guard";
import type { PostingResult } from "@/lib/accounting/types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

type PostingPeriodGuard = {
  period_guard?: PeriodGuardOptions;
};

function todayIso(date?: string | null): string {
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/** Post a folio charge line (room / order / service / guest_service). */
export async function postFolioLine(
  admin: Admin,
  propertyId: string,
  line: {
    id: string;
    source_type: string;
    description: string | null;
    total_btn: number;
    gst_btn: number;
    created_at?: string;
    /** Agent-settled charges hit AR — Agents, not guest AR. */
    bill_to?: "agent" | "guest" | null;
  } & PostingPeriodGuard,
): Promise<PostingResult> {
  const source = line.source_type;
  const base =
    source === "room"
      ? "folio_line.room"
      : source === "order"
        ? "folio_line.order"
        : source === "service"
          ? "folio_line.service"
          : source === "guest_service"
            ? "folio_line.guest_service"
            : "folio_line.other";
  const eventType =
    line.bill_to === "agent" ? `${base}.agent` : base;

  return postSimpleEvent(admin, propertyId, {
    eventType,
    sourceTable: "folio_lines",
    sourceId: line.id,
    journalDate: todayIso(line.created_at),
    amountBtn: Number(line.total_btn),
    gstBtn: Number(line.gst_btn ?? 0),
    memo: line.description ?? eventType,
    journalKind: "sales",
    periodGuard: line.period_guard,
  });
}

export async function postPayment(
  admin: Admin,
  propertyId: string,
  payment: {
    id: string;
    method: string;
    kind?: string | null;
    amount_btn: number;
    created_at?: string;
    notes?: string | null;
  } & PostingPeriodGuard,
): Promise<PostingResult> {
  const kind = (payment.kind ?? "settlement").toLowerCase();
  let eventType = "payment.bank";
  if (kind === "deposit") eventType = "payment.deposit";
  else if (kind === "refund") eventType = "payment.refund";
  else if (payment.method === "cash") eventType = "payment.cash";
  else if (payment.method === "card") eventType = "payment.card";
  else if (payment.method === "agent_credit") eventType = "payment.agent_credit";
  else eventType = "payment.bank";

  return postSimpleEvent(admin, propertyId, {
    eventType,
    sourceTable: "payments",
    sourceId: payment.id,
    journalDate: todayIso(payment.created_at),
    amountBtn: Number(payment.amount_btn),
    memo: payment.notes ?? `Payment ${payment.method}`,
    journalKind: "payment",
    periodGuard: payment.period_guard,
  });
}

/** Post a comp / allowance credit (folio line carries negative total_btn). */
export async function postCompCredit(
  admin: Admin,
  propertyId: string,
  line: {
    id: string;
    description: string | null;
    total_btn: number;
    created_at?: string;
  } & PostingPeriodGuard,
): Promise<PostingResult> {
  const amountBtn = Math.abs(Number(line.total_btn));
  if (amountBtn <= 0) return { ok: false, error: "Comp amount must be positive." };

  return postSimpleEvent(admin, propertyId, {
    eventType: "folio_line.comp",
    sourceTable: "folio_lines",
    sourceId: line.id,
    journalDate: todayIso(line.created_at),
    amountBtn,
    memo: line.description ?? "Comp credit",
    journalKind: "sales",
    periodGuard: line.period_guard,
  });
}

export async function postExpense(
  admin: Admin,
  propertyId: string,
  expense: {
    id: string;
    category: string;
    description: string;
    amount_btn: number;
    gst_btn?: number;
    expense_date: string;
    payment_method?: string;
  } & PostingPeriodGuard,
): Promise<PostingResult> {
  const category = expense.category.toLowerCase();
  const allowed = new Set([
    "supplies",
    "utilities",
    "payroll",
    "maintenance",
    "marketing",
    "tax",
    "bank_fee",
    "rent",
    "other",
  ]);
  const eventType = `expense.${allowed.has(category) ? category : "other"}`;

  // Override credit side for cash expenses via payment_method mapping in rules
  // is bank by default; for cash we temporarily use expense.other pattern
  // by swapping through a cash-specific call when needed.
  const result = await postSimpleEvent(admin, propertyId, {
    eventType,
    sourceTable: "expenses",
    sourceId: expense.id,
    journalDate: todayIso(expense.expense_date),
    amountBtn: Number(expense.amount_btn),
    gstBtn: Number(expense.gst_btn ?? 0),
    memo: expense.description,
    journalKind: "expense",
    periodGuard: expense.period_guard,
  });

  if (result.ok && expense.payment_method === "cash" && result.journalId) {
    // Re-map is handled by rules using bank; cash expenses still land in bank
    // clearing unless we post a simple transfer. Acceptable for v1.
  }

  return result;
}

export async function postInventoryMovement(
  admin: Admin,
  propertyId: string,
  movement: {
    id: string;
    movement_type: string;
    total_cost_btn: number;
    created_at?: string;
    notes?: string | null;
  },
): Promise<PostingResult> {
  const type = movement.movement_type.toLowerCase();
  const eventType =
    type === "receive" ? "inventory.receive" : "inventory.issue";
  if (!["receive", "issue", "waste"].includes(type)) {
    return { ok: true, journalId: "", skipped: true };
  }
  return postSimpleEvent(admin, propertyId, {
    eventType: type === "receive" ? "inventory.receive" : "inventory.issue",
    sourceTable: "inventory_movements",
    sourceId: movement.id,
    journalDate: todayIso(movement.created_at),
    amountBtn: Number(movement.total_cost_btn),
    memo: movement.notes ?? eventType,
    journalKind: "inventory",
  });
}

/** Accrue payroll (employer cost) to payroll payable — used when not going through expenses. */
export async function postPayrollFinalize(
  admin: Admin,
  propertyId: string,
  run: {
    id: string;
    employer_cost_btn: number;
    period_end?: string | null;
  } & PostingPeriodGuard,
): Promise<PostingResult> {
  return postSimpleEvent(admin, propertyId, {
    eventType: "payroll.finalize",
    sourceTable: "payroll_runs",
    sourceId: run.id,
    journalDate: todayIso(run.period_end),
    amountBtn: Number(run.employer_cost_btn),
    memo: "Payroll finalize",
    journalKind: "payroll",
    periodGuard: run.period_guard,
  });
}

/**
 * Net salary payout from hotel bank — clears payroll_payable.
 * sourceId = payroll_run_items.id (idempotent per payslip).
 */
export async function postPayrollPayout(
  admin: Admin,
  propertyId: string,
  item: {
    id: string;
    net_btn: number;
    full_name?: string | null;
    paid_on?: string | null;
    reference?: string | null;
  } & PostingPeriodGuard,
): Promise<PostingResult> {
  return postSimpleEvent(admin, propertyId, {
    eventType: "payroll.payout",
    sourceTable: "payroll_run_items",
    sourceId: item.id,
    journalDate: todayIso(item.paid_on),
    amountBtn: Number(item.net_btn),
    memo:
      item.reference ??
      `Payroll paid · ${item.full_name ?? item.id.slice(0, 8)}`,
    journalKind: "payroll",
    periodGuard: item.period_guard,
  });
}

/**
 * Walk-in POS tender with no folio — hits cash/bank/card and F&B revenue immediately.
 * sourceId = order_tenders id (or synthetic key when no tender row id).
 */
export async function postPosWalkInTender(
  admin: Admin,
  propertyId: string,
  tender: {
    id: string;
    method: string;
    amount_btn: number;
    gst_btn?: number;
    created_at?: string;
    notes?: string | null;
  } & PostingPeriodGuard,
): Promise<PostingResult> {
  const method = (tender.method ?? "cash").toLowerCase();
  let eventType = "pos.walk_in.cash";
  if (method === "card") eventType = "pos.walk_in.card";
  else if (
    method === "bank" ||
    method === "bank_qr" ||
    method === "pay_bt" ||
    method === "deposit"
  ) {
    eventType = "pos.walk_in.bank";
  } else if (method === "cash") {
    eventType = "pos.walk_in.cash";
  } else {
    // Unknown non-room tender — treat as cash sale so hotel account still moves.
    eventType = "pos.walk_in.cash";
  }

  return postSimpleEvent(admin, propertyId, {
    eventType,
    sourceTable: "order_tenders",
    sourceId: tender.id,
    journalDate: todayIso(tender.created_at),
    amountBtn: Number(tender.amount_btn),
    gstBtn: Number(tender.gst_btn ?? 0),
    memo: tender.notes ?? `POS walk-in · ${method}`,
    journalKind: "sales",
    periodGuard: tender.period_guard,
  });
}

/** Vendor AP bill: expense holding / Dr expense Cr AP. */
export async function postApBill(
  admin: Admin,
  propertyId: string,
  bill: {
    id: string;
    total_btn: number;
    gst_btn?: number;
    bill_date: string;
    description: string;
  } & PostingPeriodGuard,
): Promise<PostingResult> {
  return postSimpleEvent(admin, propertyId, {
    eventType: "ap.bill",
    sourceTable: "accounting_bills",
    sourceId: bill.id,
    journalDate: todayIso(bill.bill_date),
    amountBtn: Number(bill.total_btn),
    gstBtn: Number(bill.gst_btn ?? 0),
    memo: bill.description,
    journalKind: "expense",
    periodGuard: bill.period_guard,
  });
}

/** Pay open vendor bill from hotel bank. */
export async function postApPay(
  admin: Admin,
  propertyId: string,
  bill: {
    id: string;
    amount_btn: number;
    paid_on?: string | null;
    description?: string | null;
  } & PostingPeriodGuard,
): Promise<PostingResult> {
  return postSimpleEvent(admin, propertyId, {
    eventType: "ap.pay",
    sourceTable: "accounting_bills",
    sourceId: `pay:${bill.id}`,
    journalDate: todayIso(bill.paid_on),
    amountBtn: Number(bill.amount_btn),
    memo: bill.description ?? "Vendor bill payment",
    journalKind: "payment",
    periodGuard: bill.period_guard,
  });
}
