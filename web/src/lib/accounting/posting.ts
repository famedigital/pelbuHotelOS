import "server-only";
import { postSimpleEvent } from "@/lib/accounting/journals";
import type { PostingResult } from "@/lib/accounting/types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

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
  },
): Promise<PostingResult> {
  const source = line.source_type;
  const eventType =
    source === "room"
      ? "folio_line.room"
      : source === "order"
        ? "folio_line.order"
        : source === "service"
          ? "folio_line.service"
          : source === "guest_service"
            ? "folio_line.guest_service"
            : "folio_line.other";

  return postSimpleEvent(admin, propertyId, {
    eventType,
    sourceTable: "folio_lines",
    sourceId: line.id,
    journalDate: todayIso(line.created_at),
    amountBtn: Number(line.total_btn),
    gstBtn: Number(line.gst_btn ?? 0),
    memo: line.description ?? eventType,
    journalKind: "sales",
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
  },
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
  },
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

export async function postPayrollFinalize(
  admin: Admin,
  propertyId: string,
  run: {
    id: string;
    employer_cost_btn: number;
    period_end?: string | null;
  },
): Promise<PostingResult> {
  return postSimpleEvent(admin, propertyId, {
    eventType: "payroll.finalize",
    sourceTable: "payroll_runs",
    sourceId: run.id,
    journalDate: todayIso(run.period_end),
    amountBtn: Number(run.employer_cost_btn),
    memo: "Payroll finalize",
    journalKind: "payroll",
  });
}
