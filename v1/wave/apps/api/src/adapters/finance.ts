import { z } from "zod";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";

function mapPaidVia(method: string): string {
  const m = method.toLowerCase();
  if (m === "cash" || m === "front_till") return "front_till";
  if (m === "mbob" || m === "wire" || m === "transfer" || m === "bank")
    return "mbob_wire";
  if (m === "cheque" || m === "check") return "cheque";
  if (m === "credit" || m === "credit_unpaid") return "credit_unpaid";
  return "front_till";
}

export async function listExpenses(
  ctx: AdapterCtx,
  from?: string,
  to?: string,
) {
  let q = ctx.admin
    .from("property_expenses")
    .select(
      "id, description, amount_btn, category, supplier_name, recorded_at, paid_via, till_shift_id",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .order("recorded_at", { ascending: false })
    .limit(200);
  if (from) q = q.gte("recorded_at", `${from}T00:00:00Z`);
  if (to) q = q.lte("recorded_at", `${to}T23:59:59Z`);
  const { data, error } = await q;
  if (error) {
    console.error("[listExpenses] property_expenses", error);
    throw new Error(
      error.message ??
        "property_expenses unavailable — apply v2 till migration",
    );
  }
  return {
    expenses: (data ?? []).map((e) => ({
      id: e.id,
      description: e.description,
      amount_btn: e.amount_btn,
      category: e.category,
      vendor: e.supplier_name,
      expense_date: e.recorded_at,
      payment_method: e.paid_via,
      created_at: e.recorded_at,
      status: "posted",
      till_shift_id: e.till_shift_id,
    })),
  };
}

const expenseSchema = z.object({
  description: z.string().min(1),
  amountBtn: z.number().positive(),
  category: z.string().default("ops"),
  vendor: z.string().optional(),
  spentAt: z.string().optional(),
  paymentMethod: z.string().default("cash"),
  idempotencyKey: z.string().uuid(),
});

export async function createExpense(ctx: AdapterCtx, raw: unknown) {
  const input = expenseSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const paidVia = mapPaidVia(input.paymentMethod);
  const { data: rpcRaw, error } = await ctx.admin.rpc(
    "record_expense_and_till_deduct",
    {
      p_property_id: ctx.jwt.propertyId,
      p_staff_id: ctx.jwt.staffId,
      p_category: input.category,
      p_description: input.description,
      p_amount_btn: Math.round(input.amountBtn * 100) / 100,
      p_paid_via: paidVia,
      p_supplier_name: input.vendor ?? null,
      p_idempotency_key: input.idempotencyKey,
    },
  );

  if (error) {
    console.error("[createExpense] record_expense_and_till_deduct failed", error);
    throw new Error(error.message ?? "Could not record expense against till");
  }

  const rpc = (rpcRaw ?? {}) as {
    ok?: boolean;
    expense_id?: string;
    amount_btn?: number;
    replayed?: boolean;
  };

  if (!rpc.expense_id) {
    throw new Error("record_expense_and_till_deduct returned no expense_id");
  }

  const result = {
    ok: true,
    expenseId: rpc.expense_id,
    amountBtn: Number(rpc.amount_btn ?? input.amountBtn),
    paidVia,
    alreadyExists: Boolean(rpc.replayed),
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "create_expense",
    result,
  );
  return result;
}

export async function getFinanceHub(ctx: AdapterCtx) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Thimphu",
  });
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: expenses, error: eErr }, { data: payments }, { data: vendors }] =
    await Promise.all([
      ctx.admin
        .from("property_expenses")
        .select("amount_btn")
        .eq("property_id", ctx.jwt.propertyId)
        .gte("recorded_at", `${monthStart}T00:00:00Z`),
      ctx.admin
        .from("payments")
        .select("amount_btn, method, confirmation_status")
        .eq("property_id", ctx.jwt.propertyId)
        .gte("created_at", `${monthStart}T00:00:00Z`),
      ctx.admin
        .from("accounting_vendors")
        .select("id, name, tax_id, phone, email, payment_terms_days, is_active")
        .eq("property_id", ctx.jwt.propertyId)
        .eq("is_active", true)
        .order("name")
        .limit(100),
    ]);

  if (eErr) {
    console.error("[getFinanceHub] property_expenses", eErr);
    throw new Error(
      eErr.message ??
        "property_expenses unavailable — apply v2 till migration",
    );
  }

  const expenseTotal = (expenses ?? []).reduce(
    (s, e) => s + Number(e.amount_btn || 0),
    0,
  );
  const cashIn = (payments ?? [])
    .filter((p) => p.confirmation_status !== "rejected")
    .reduce((s, p) => s + Number(p.amount_btn || 0), 0);

  return {
    monthStart,
    expenseTotalBtn: Math.round(expenseTotal * 100) / 100,
    paymentsInBtn: Math.round(cashIn * 100) / 100,
    vendors: vendors ?? [],
  };
}

/**
 * RRCO books for a tax year. Real tables: rrco_filings (one per property/year)
 * + rrco_lines. Lines are pulled into a filing by the Innora RRCO workbench.
 */
export async function getRrcoBooks(ctx: AdapterCtx, year?: number) {
  const y = year || Number(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" }).slice(0, 4),
  );
  const { data: filing, error: fErr } = await ctx.admin
    .from("rrco_filings")
    .select("id, tax_year, status, cash_in_hand_btn, tds_btn, capital_btn, prepared_by")
    .eq("property_id", ctx.jwt.propertyId)
    .eq("tax_year", y)
    .maybeSingle();
  if (fErr) throw fErr;
  if (!filing) return { year: y, filing: null, entries: [] };

  const { data, error } = await ctx.admin
    .from("rrco_lines")
    .select(
      "id, source_kind, txn_date, description, amount_btn, side, category, treatment, original_ref, party",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .eq("filing_id", filing.id)
    .order("txn_date");
  if (error) throw error;
  return {
    year: y,
    filing,
    entries: (data ?? []).map((l) => ({
      ...l,
      // Desk UI field names
      entry_date: l.txn_date,
      book_kind: `${l.side}${l.category ? ` · ${l.category}` : ""}`,
      ref: l.original_ref,
    })),
  };
}
