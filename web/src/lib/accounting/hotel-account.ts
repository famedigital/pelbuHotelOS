import "server-only";
import { buildTrialBalance } from "@/lib/accounting/reports";
import { roundBtn } from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type HotelAccountVault = {
  cashBtn: number;
  bankBtn: number;
  cardClearingBtn: number;
  liquidBtn: number;
  arGuestBtn: number;
  arAgentBtn: number;
  depositsBtn: number;
  apBtn: number;
  payrollPayableBtn: number;
  gstNetBtn: number;
};

export type HotelAccountAttention = {
  unmatchedBank: number;
  pendingBankProofs: number;
  postingErrors: number;
  openBills: number;
  unpaidPayslips: number;
  periodLabel: string | null;
  periodStatus: string | null;
  openingBalancesPosted: boolean;
};

export type HotelAccountSnapshot = {
  vault: HotelAccountVault;
  attention: HotelAccountAttention;
  mtd: {
    receiptsBtn: number;
    expensesBtn: number;
    netIncomeBtn: number;
  };
  from: string;
  to: string;
};

async function balanceBySystemKeys(
  admin: Admin,
  propertyId: string,
  through: string,
  keys: string[],
): Promise<Record<string, number>> {
  const trial = await buildTrialBalance(admin, propertyId, "1900-01-01", through);
  const { data: accounts } = await admin
    .from("accounting_accounts")
    .select("id, system_key, account_type")
    .eq("property_id", propertyId)
    .in("system_key", keys);

  const idMeta = new Map(
    (accounts ?? [])
      .filter((a) => a.system_key)
      .map((a) => [
        a.id as string,
        {
          key: a.system_key as string,
          type: a.account_type as string,
        },
      ]),
  );

  const out: Record<string, number> = Object.fromEntries(
    keys.map((k) => [k, 0]),
  );
  for (const row of trial) {
    const meta = idMeta.get(row.accountId);
    if (!meta) continue;
    const debitNormal =
      meta.type === "asset" ||
      meta.type === "expense" ||
      meta.type === "cogs";
    out[meta.key] = roundBtn(
      debitNormal ? row.closingDebit || 0 : row.closingCredit || 0,
    );
  }
  return out;
}

export async function buildHotelAccountSnapshot(
  admin: Admin,
  propertyId: string,
  from: string,
  to: string,
): Promise<HotelAccountSnapshot> {
  const keys = [
    "cash",
    "bank",
    "card_clearing",
    "ar_guest",
    "ar_agent",
    "deposits",
    "ap",
    "payroll_payable",
    "gst_output",
    "gst_input",
  ];

  const [
    bal,
    unmatchedRes,
    pendingProofsRes,
    postingErrorsRes,
    openBillsRes,
    unpaidPaysRes,
    periodRes,
    openingRes,
    paymentsRes,
    expensesRes,
  ] = await Promise.all([
    balanceBySystemKeys(admin, propertyId, to, keys),
    admin
      .from("bank_transactions")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("match_status", "unmatched"),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("confirmation_status", "pending_bank"),
    admin
      .from("accounting_posting_events")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "error"),
    admin
      .from("accounting_bills")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .in("status", ["open", "partial"]),
    admin
      .from("payroll_run_items")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("payment_status", "unpaid"),
    admin
      .from("accounting_periods")
      .select("id, label, status")
      .eq("property_id", propertyId)
      .lte("starts_on", to)
      .gte("ends_on", to)
      .maybeSingle(),
    admin
      .from("accounting_opening_balances")
      .select("status")
      .eq("property_id", propertyId)
      .maybeSingle(),
    admin
      .from("payments")
      .select("amount_btn")
      .eq("property_id", propertyId)
      .gte("created_at", from)
      .eq("confirmation_status", "confirmed"),
    admin
      .from("expenses")
      .select("amount_btn, expense_date")
      .eq("property_id", propertyId)
      .gte("expense_date", from)
      .lte("expense_date", to),
  ]);

  const cash = bal.cash ?? 0;
  const bank = bal.bank ?? 0;
  const card = bal.card_clearing ?? 0;
  const gstOutput = bal.gst_output ?? 0;
  const gstInput = bal.gst_input ?? 0;

  const receiptsBtn = roundBtn(
    (paymentsRes.data ?? []).reduce((s, p) => s + Number(p.amount_btn ?? 0), 0),
  );
  const expensesBtn = roundBtn(
    (expensesRes.data ?? []).reduce((s, e) => s + Number(e.amount_btn ?? 0), 0),
  );

  return {
    from,
    to,
    vault: {
      cashBtn: cash,
      bankBtn: bank,
      cardClearingBtn: card,
      liquidBtn: roundBtn(cash + bank + card),
      arGuestBtn: bal.ar_guest ?? 0,
      arAgentBtn: bal.ar_agent ?? 0,
      depositsBtn: bal.deposits ?? 0,
      apBtn: bal.ap ?? 0,
      payrollPayableBtn: bal.payroll_payable ?? 0,
      gstNetBtn: roundBtn(gstOutput - gstInput),
    },
    attention: {
      unmatchedBank: unmatchedRes.count ?? 0,
      pendingBankProofs: pendingProofsRes.count ?? 0,
      postingErrors: postingErrorsRes.count ?? 0,
      openBills: openBillsRes.count ?? 0,
      unpaidPayslips: unpaidPaysRes.count ?? 0,
      periodLabel: (periodRes.data?.label as string | null) ?? null,
      periodStatus: (periodRes.data?.status as string | null) ?? null,
      openingBalancesPosted: openingRes.data?.status === "posted",
    },
    mtd: {
      receiptsBtn,
      expensesBtn,
      netIncomeBtn: roundBtn(receiptsBtn - expensesBtn),
    },
  };
}
