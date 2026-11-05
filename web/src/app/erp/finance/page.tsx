import { buildHotelAccountSnapshot } from "@/lib/accounting/hotel-account";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadClosedDay } from "@/lib/finance/closed-day";
import { thimphuToday, fmtDate } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ExecutiveFinanceCockpit } from "@/components/erp/finance/ExecutiveFinanceCockpit";
import type {
  FinanceExpenseOption,
  FinancePaymentOption,
  UnmatchedBankTxn,
} from "@/components/erp/FinanceForms";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Executive Finance Treasury | Hotel OS Bhutan",
  description: "Real-time hotel cash in hand, daily revenue, and 1-click bank reconciliation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ErpFinanceOverviewPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const since = monthStartIso();
  const to = todayIso();
  const today = thimphuToday();

  const [snap, closed, paymentsRes, expensesRes, unmatchedRes] = await Promise.all([
    buildHotelAccountSnapshot(admin, propertyId, since, to),
    loadClosedDay(admin, propertyId, today),
    admin
      .from("payments")
      .select("id, amount_btn, method, reference, notes, created_at, folio_id")
      .eq("property_id", propertyId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("expenses")
      .select(
        "id, category, description, amount_btn, gst_btn, expense_date, vendor, payment_method, reference, created_at"
      )
      .eq("property_id", propertyId)
      .order("expense_date", { ascending: false })
      .limit(50),
    admin
      .from("bank_transactions")
      .select(
        "id, bank_code, txn_date, description, debit_btn, credit_btn, reference, match_status"
      )
      .eq("property_id", propertyId)
      .eq("match_status", "unmatched")
      .order("txn_date", { ascending: false })
      .limit(30),
  ]);

  const unmatched = (unmatchedRes.data ?? []) as UnmatchedBankTxn[];

  const paymentOptions: FinancePaymentOption[] = (paymentsRes.data ?? []).map((p) => ({
    id: p.id as string,
    amount_btn: Number(p.amount_btn),
    method: p.method as string,
    reference: (p.reference as string | null) ?? null,
    created_at: p.created_at as string,
    label: `${String(p.created_at).slice(0, 10)} · ${formatBtn(Number(p.amount_btn))} · ${p.method}`,
  }));

  const expenseOptions: FinanceExpenseOption[] = (expensesRes.data ?? []).map((e) => ({
    id: e.id as string,
    amount_btn: Number(e.amount_btn),
    description: e.description as string,
    expense_date: e.expense_date as string,
    reference: (e.reference as string | null) ?? null,
  }));

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <ExecutiveFinanceCockpit
        snapshot={snap}
        closedDay={closed}
        unmatched={unmatched}
        payments={paymentOptions}
        expenses={expenseOptions}
        todayDate={fmtDate(today)}
      />
    </div>
  );
}
