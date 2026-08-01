"use server";

import { writeAuditEvent } from "@/lib/audit";
import { postExpense } from "@/lib/accounting/posting";
import { assertOpenPeriodForDate } from "@/lib/accounting/period-guard";
import { periodGuardFromForm } from "@/lib/accounting/period-guard-form";
import { requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ErpFinanceState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const BANKS = new Set(["bob", "bnb", "tbank", "drukpnb"]);
const EXPENSE_CATEGORIES = new Set([
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
const PAY_METHODS = new Set(["cash", "bank", "card"]);

async function propertyId(admin: Admin) {
  return resolveActivePropertyId(admin);
}

function revalidateFinance() {
  revalidatePath("/erp/finance");
  revalidatePath("/erp");
}

function parseMoney(raw: FormDataEntryValue | null, label: string): number {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} must be a positive amount.`);
  }
  return roundBtn(n);
}

export async function createExpense(
  _prev: ErpFinanceState,
  formData: FormData,
): Promise<ErpFinanceState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);

    const category = trimRequired(formData.get("category"), "Category").toLowerCase();
    if (!EXPENSE_CATEGORIES.has(category)) {
      throw new Error("Invalid expense category.");
    }
    const paymentMethod = trimRequired(
      formData.get("payment_method"),
      "Payment method",
    ).toLowerCase();
    if (!PAY_METHODS.has(paymentMethod)) {
      throw new Error("Payment method must be cash, bank, or card.");
    }

    const amountBtn = parseMoney(formData.get("amount_btn"), "Amount");
    const gstRaw = String(formData.get("gst_btn") ?? "").trim();
    const gstBtn = gstRaw ? roundBtn(Number(gstRaw.replace(/,/g, ""))) : 0;
    if (!Number.isFinite(gstBtn) || gstBtn < 0) {
      throw new Error("GST must be zero or positive.");
    }

    const description = trimRequired(formData.get("description"), "Description");
    const expenseDate = trimRequired(formData.get("expense_date"), "Date");
    await assertOpenPeriodForDate(admin, pid, expenseDate, {
      propertyId: pid,
      ...periodGuardFromForm(formData, pid),
    });

    const vendorId = optionalTrim(formData.get("vendor_id"));
    let vendorName = optionalTrim(formData.get("vendor"));
    let vendorTpn = optionalTrim(formData.get("tpn"));
    if (vendorId) {
      const { data: vendor } = await admin
        .from("accounting_vendors")
        .select("name, tax_id")
        .eq("id", vendorId)
        .eq("property_id", pid)
        .maybeSingle();
      if (vendor) {
        vendorName = vendor.name as string;
        vendorTpn = (vendor.tax_id as string | null) ?? vendorTpn;
      }
    }

    const leasePeriodMonth = optionalTrim(formData.get("lease_period_month"));
    const leaseLandlord = optionalTrim(formData.get("lease_landlord"));

    const { data: expense, error } = await admin
      .from("expenses")
      .insert({
        property_id: pid,
        category,
        description,
        amount_btn: amountBtn,
        gst_btn: gstBtn,
        expense_date: expenseDate,
        vendor: vendorName,
        vendor_id: vendorId,
        tpn: vendorTpn,
        payment_method: paymentMethod,
        reference: optionalTrim(formData.get("reference")),
        notes: optionalTrim(formData.get("notes")),
        lease_period_month: leasePeriodMonth || null,
        lease_landlord: leaseLandlord || null,
      })
      .select("id")
      .single();
    if (error || !expense) {
      console.error("expenses insert failed", error);
      throw new Error("Could not save expense.");
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "expense.create",
      entityType: "expenses",
      entityId: expense.id as string,
      summary: `Expense ${amountBtn} Nu · ${description}`,
      meta: { category, amountBtn },
    });

    const posting = await postExpense(admin, pid, {
      id: expense.id as string,
      category,
      description,
      amount_btn: amountBtn,
      gst_btn: gstBtn,
      expense_date: expenseDate,
      payment_method: paymentMethod,
    });
    if (posting.ok && posting.journalId) {
      await admin
        .from("expenses")
        .update({ journal_id: posting.journalId })
        .eq("id", expense.id);
    }

    revalidateFinance();
    return {
      ok: true,
      message: posting.ok
        ? "Expense recorded and posted to ledger."
        : `Expense saved; ledger posting pending: ${posting.error}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

type ParsedTxnIn = {
  bank_code?: string;
  txn_date: string;
  value_date?: string | null;
  description: string;
  debit_btn?: number;
  credit_btn?: number;
  balance_btn?: number | null;
  reference?: string | null;
  raw_line?: string | null;
  fingerprint?: string;
};

export async function importBankStatementJson(
  _prev: ErpFinanceState,
  formData: FormData,
): Promise<ErpFinanceState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);

    const bankCode = trimRequired(formData.get("bank_code"), "Bank").toLowerCase();
    if (!BANKS.has(bankCode)) {
      throw new Error("Bank must be bob, bnb, tbank, or drukpnb.");
    }

    const jsonRaw = trimRequired(formData.get("statement_json"), "Statement JSON");
    let doc: {
      bank_code?: string;
      account_label?: string | null;
      period_start?: string | null;
      period_end?: string | null;
      source?: string;
      transactions?: ParsedTxnIn[];
    };
    try {
      doc = JSON.parse(jsonRaw) as typeof doc;
    } catch {
      throw new Error("Statement JSON is not valid JSON.");
    }

    const txns = doc.transactions ?? [];
    if (!Array.isArray(txns) || txns.length === 0) {
      throw new Error("JSON must include a non-empty transactions array.");
    }

    const sourceFilename =
      optionalTrim(formData.get("source_filename")) ??
      doc.source ??
      "pasted.json";
    const sha = createHash("sha256").update(jsonRaw).digest("hex");

    const { data: existing } = await admin
      .from("bank_statements")
      .select("id")
      .eq("property_id", pid)
      .eq("source_sha256", sha)
      .maybeSingle();
    if (existing?.id) {
      throw new Error("This statement JSON was already imported.");
    }

    const { data: statement, error: stErr } = await admin
      .from("bank_statements")
      .insert({
        property_id: pid,
        bank_code: bankCode,
        account_label: optionalTrim(formData.get("account_label")) ?? doc.account_label ?? null,
        period_start: doc.period_start ?? null,
        period_end: doc.period_end ?? null,
        source_filename: sourceFilename,
        source_sha256: sha,
        status: "parsed",
        parsed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (stErr || !statement) {
      console.error("bank_statements insert failed", stErr);
      throw new Error("Could not create bank statement.");
    }

    const rows = txns.map((t) => {
      const debit = roundBtn(Number(t.debit_btn ?? 0));
      const credit = roundBtn(Number(t.credit_btn ?? 0));
      const fingerprint =
        t.fingerprint ??
        createHash("sha256")
          .update(
            [
              bankCode,
              t.txn_date,
              t.description.trim().toLowerCase(),
              debit.toFixed(2),
              credit.toFixed(2),
              (t.reference ?? "").toLowerCase(),
            ].join("|"),
          )
          .digest("hex")
          .slice(0, 40);
      return {
        statement_id: statement.id as string,
        property_id: pid,
        bank_code: bankCode,
        txn_date: t.txn_date,
        value_date: t.value_date ?? null,
        description: String(t.description).trim(),
        debit_btn: debit,
        credit_btn: credit,
        balance_btn: t.balance_btn ?? null,
        reference: t.reference ?? null,
        raw_line: t.raw_line ?? null,
        fingerprint,
        match_status: "unmatched",
      };
    });

    const { error: txErr } = await admin.from("bank_transactions").insert(rows);
    if (txErr) {
      console.error("bank_transactions insert failed", txErr);
      await admin.from("bank_statements").delete().eq("id", statement.id);
      throw new Error("Could not import transactions (duplicate or invalid rows).");
    }

    revalidateFinance();
    return {
      ok: true,
      message: `Imported ${rows.length} transactions from ${bankCode.toUpperCase()}.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function matchBankTxn(
  _prev: ErpFinanceState,
  formData: FormData,
): Promise<ErpFinanceState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);

    const txnId = trimRequired(formData.get("bank_txn_id"), "Bank transaction");
    const paymentId = optionalTrim(formData.get("payment_id"));
    const expenseId = optionalTrim(formData.get("expense_id"));
    if (!paymentId && !expenseId) {
      throw new Error("Pick a payment or an expense to match.");
    }
    if (paymentId && expenseId) {
      throw new Error("Match to either a payment or an expense, not both.");
    }

    const { data: txn, error: txnErr } = await admin
      .from("bank_transactions")
      .select("id, property_id, credit_btn, debit_btn, match_status")
      .eq("id", txnId)
      .single();
    if (txnErr || !txn) {
      throw new Error("Bank transaction not found.");
    }
    assertDeskProperty(pid, txn.property_id as string, "Bank transaction");
    if ((txn.match_status as string) === "matched") {
      throw new Error("Already matched.");
    }

    const amount = roundBtn(
      Number(txn.credit_btn) > 0 ? Number(txn.credit_btn) : Number(txn.debit_btn),
    );
    if (amount <= 0) {
      throw new Error("Transaction has no amount to match.");
    }

    if (paymentId) {
      const { data: pay } = await admin
        .from("payments")
        .select("id, amount_btn, booking_id, kind")
        .eq("id", paymentId)
        .eq("property_id", pid)
        .single();
      if (!pay) throw new Error("Payment not found.");
    }
    if (expenseId) {
      const { data: exp } = await admin
        .from("expenses")
        .select("id, amount_btn")
        .eq("id", expenseId)
        .eq("property_id", pid)
        .single();
      if (!exp) throw new Error("Expense not found.");
    }

    const { error: mErr } = await admin.from("bank_recon_matches").insert({
      property_id: pid,
      bank_txn_id: txnId,
      payment_id: paymentId,
      expense_id: expenseId,
      match_kind: "manual",
      matched_amount_btn: amount,
      note: optionalTrim(formData.get("note")),
      matched_by: "desk",
    });
    if (mErr) {
      console.error("bank_recon_matches insert failed", mErr);
      throw new Error("Could not save match.");
    }

    const { error: uErr } = await admin
      .from("bank_transactions")
      .update({ match_status: "matched" })
      .eq("id", txnId);
    if (uErr) {
      console.error("bank_transactions status update failed", uErr);
      throw new Error("Match saved but status update failed.");
    }

    if (paymentId) {
      const { data: pay } = await admin
        .from("payments")
        .select("id, amount_btn, booking_id, kind")
        .eq("id", paymentId)
        .eq("property_id", pid)
        .single();
      if (
        pay?.booking_id &&
        (pay.kind === "deposit" || Number(pay.amount_btn) > 0)
      ) {
        const { data: booking } = await admin
          .from("bookings")
          .select("id, status, token_received_btn")
          .eq("id", pay.booking_id)
          .eq("property_id", pid)
          .maybeSingle();
        if (booking && ["held", "pending"].includes(booking.status as string)) {
          const received =
            Number(booking.token_received_btn ?? 0) + Number(pay.amount_btn);
          await admin
            .from("bookings")
            .update({
              status: "confirmed",
              token_received_btn: received,
              confirmed_at: new Date().toISOString(),
              confirmed_by: "bank_recon",
              payment_mode: "partial",
            })
            .eq("id", booking.id);
          await admin
            .from("payment_links")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              payment_id: paymentId,
            })
            .eq("booking_id", booking.id)
            .eq("status", "open");
        }
      }
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "bank.match",
      entityType: "bank_transactions",
      entityId: txnId,
      summary: `Matched bank txn ${amount} Nu`,
      meta: { paymentId, expenseId },
    });

    revalidateFinance();
    return { ok: true, message: "Matched." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function ignoreBankTxn(
  _prev: ErpFinanceState,
  formData: FormData,
): Promise<ErpFinanceState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const txnId = trimRequired(formData.get("bank_txn_id"), "Bank transaction");

    const { data: txn } = await admin
      .from("bank_transactions")
      .select("id, property_id")
      .eq("id", txnId)
      .single();
    if (!txn) throw new Error("Bank transaction not found.");
    assertDeskProperty(pid, txn.property_id as string, "Bank transaction");

    const { error } = await admin
      .from("bank_transactions")
      .update({ match_status: "ignored" })
      .eq("id", txnId)
      .eq("property_id", pid);
    if (error) {
      throw new Error("Could not ignore transaction.");
    }

    revalidateFinance();
    return { ok: true, message: "Marked ignored." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

type AutoCandPayment = {
  id: string;
  amount_btn: number;
  method: string;
  reference: string | null;
  created_at: string;
};

type AutoCandExpense = {
  id: string;
  amount_btn: number;
  reference: string | null;
  expense_date: string;
  description: string;
};

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso.slice(0, 10));
  const b = Date.parse(bIso.slice(0, 10));
  return Math.abs(Math.round((a - b) / 86_400_000));
}

function scorePayment(
  p: AutoCandPayment,
  credit: number,
  txnDate: string,
  ref: string,
  desc: string,
  window: number,
): { score: number; reason: string } {
  if (Math.abs(p.amount_btn - credit) > 0.05) return { score: 0, reason: "" };
  let score = 0.4;
  const reasons = ["amount"];
  if (p.method === "bank") {
    score += 0.1;
    reasons.push("bank_method");
  }
  const pref = (p.reference ?? "").trim().toLowerCase();
  if (ref && pref && (ref === pref || ref.includes(pref) || pref.includes(ref) || desc.includes(pref))) {
    score += 0.45;
    reasons.push("reference");
  }
  const delta = daysBetween(txnDate, p.created_at);
  if (delta > window) return { score: 0, reason: "" };
  score += 0.25 * (1 - delta / Math.max(window, 1));
  reasons.push(`date±${delta}`);
  return { score: Math.min(score, 1), reason: reasons.join("+") };
}

function scoreExpense(
  e: AutoCandExpense,
  debit: number,
  txnDate: string,
  ref: string,
  desc: string,
  window: number,
): { score: number; reason: string } {
  if (Math.abs(e.amount_btn - debit) > 0.05) return { score: 0, reason: "" };
  let score = 0.4;
  const reasons = ["amount"];
  const pref = (e.reference ?? "").trim().toLowerCase();
  if (ref && pref && (ref === pref || ref.includes(pref) || pref.includes(ref))) {
    score += 0.45;
    reasons.push("reference");
  }
  const delta = daysBetween(txnDate, e.expense_date);
  if (delta > window) return { score: 0, reason: "" };
  score += 0.25 * (1 - delta / Math.max(window, 1));
  reasons.push(`date±${delta}`);
  if (e.description && desc.includes(e.description.toLowerCase().slice(0, 12))) {
    score += 0.05;
  }
  return { score: Math.min(score, 1), reason: reasons.join("+") };
}

/** Auto-match unmatched bank lines using the same heuristics as scripts/bank-recon. */
export async function autoMatchBankTxns(
  _prev: ErpFinanceState,
  _formData: FormData,
): Promise<ErpFinanceState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const windowDays = 3;

    const [{ data: txns }, { data: payments }, { data: expenses }] = await Promise.all([
      admin
        .from("bank_transactions")
        .select("id, txn_date, description, debit_btn, credit_btn, reference")
        .eq("property_id", pid)
        .eq("match_status", "unmatched")
        .order("txn_date", { ascending: false })
        .limit(200),
      admin
        .from("payments")
        .select("id, amount_btn, method, reference, created_at")
        .eq("property_id", pid)
        .order("created_at", { ascending: false })
        .limit(300),
      admin
        .from("expenses")
        .select("id, amount_btn, reference, expense_date, description")
        .eq("property_id", pid)
        .order("expense_date", { ascending: false })
        .limit(300),
    ]);

    const payList = (payments ?? []) as AutoCandPayment[];
    const expList = (expenses ?? []) as AutoCandExpense[];
    const usedPay = new Set<string>();
    const usedExp = new Set<string>();
    let matched = 0;

    for (const txn of txns ?? []) {
      const credit = roundBtn(Number(txn.credit_btn ?? 0));
      const debit = roundBtn(Number(txn.debit_btn ?? 0));
      const txnDate = String(txn.txn_date);
      const ref = String(txn.reference ?? "")
        .trim()
        .toLowerCase();
      const desc = String(txn.description ?? "").toLowerCase();

      let best:
        | {
            kind: "payment" | "expense";
            id: string;
            amount: number;
            score: number;
            reason: string;
          }
        | null = null;

      if (credit > 0) {
        for (const p of payList) {
          if (usedPay.has(p.id)) continue;
          const { score, reason } = scorePayment(
            { ...p, amount_btn: Number(p.amount_btn) },
            credit,
            txnDate,
            ref,
            desc,
            windowDays,
          );
          if (score <= 0) continue;
          if (!best || score > best.score) {
            best = { kind: "payment", id: p.id, amount: credit, score, reason };
          }
        }
      } else if (debit > 0) {
        for (const e of expList) {
          if (usedExp.has(e.id)) continue;
          const { score, reason } = scoreExpense(
            {
              ...e,
              amount_btn: Number(e.amount_btn),
              description: String(e.description ?? ""),
            },
            debit,
            txnDate,
            ref,
            desc,
            windowDays,
          );
          if (score <= 0) continue;
          if (!best || score > best.score) {
            best = { kind: "expense", id: e.id, amount: debit, score, reason };
          }
        }
      }

      if (!best || best.score < 0.55) continue;

      const { error: mErr } = await admin.from("bank_recon_matches").insert({
        property_id: pid,
        bank_txn_id: txn.id,
        payment_id: best.kind === "payment" ? best.id : null,
        expense_id: best.kind === "expense" ? best.id : null,
        match_kind: "auto",
        matched_amount_btn: best.amount,
        note: `auto:${best.reason}`,
        matched_by: "desk-auto",
      });
      if (mErr) {
        console.error("auto match insert failed", mErr);
        continue;
      }

      const { error: uErr } = await admin
        .from("bank_transactions")
        .update({ match_status: "matched" })
        .eq("id", txn.id);
      if (uErr) {
        console.error("auto match status failed", uErr);
        await admin.from("bank_recon_matches").delete().eq("bank_txn_id", txn.id);
        continue;
      }

      if (best.kind === "payment") usedPay.add(best.id);
      else usedExp.add(best.id);
      matched += 1;
    }

    revalidateFinance();
    return {
      ok: true,
      message:
        matched === 0
          ? "No confident auto-matches (need amount + date ±3d, preferably reference)."
          : `Auto-matched ${matched} transaction${matched === 1 ? "" : "s"}.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createVendor(
  _prev: ErpFinanceState,
  formData: FormData,
): Promise<ErpFinanceState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const name = trimRequired(formData.get("name"), "Vendor name");
    const taxId = optionalTrim(formData.get("tax_id"));
    const phone = optionalTrim(formData.get("phone"));
    const email = optionalTrim(formData.get("email"));
    const notes = optionalTrim(formData.get("notes"));

    const { error } = await admin.from("accounting_vendors").insert({
      property_id: pid,
      name,
      tax_id: taxId,
      phone,
      email,
      notes,
    });
    if (error) throw new Error(error.message);

    revalidateFinance();
    revalidatePath("/erp/finance/vendors");
    return { ok: true, message: `Vendor ${name} saved.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function saveGstReturnPack(
  _prev: ErpFinanceState,
  formData: FormData,
): Promise<ErpFinanceState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const periodMonth = trimRequired(formData.get("period_month"), "Month");
    const fieldA = roundBtn(Number(formData.get("field_a") ?? 0));
    const fieldB = roundBtn(Number(formData.get("field_b") ?? 0));
    const fieldC = roundBtn(Number(formData.get("field_c") ?? 0));
    const fieldD = roundBtn(Number(formData.get("field_d") ?? 0));
    const fieldE = roundBtn(Number(formData.get("field_e") ?? 0));
    const bankStatementId = optionalTrim(formData.get("bank_statement_id"));
    const notes = optionalTrim(formData.get("notes"));

    const { error } = await admin.from("gst_return_packs").upsert(
      {
        property_id: pid,
        period_month: periodMonth,
        field_a_taxable_sales: fieldA,
        field_b_gst_output: fieldB,
        field_c_taxable_purchases: fieldC,
        field_d_gst_input: fieldD,
        field_e_net_payable: fieldE,
        bank_statement_id: bankStatementId,
        notes,
        status: "draft",
      },
      { onConflict: "property_id,period_month" },
    );
    if (error) throw new Error(error.message);

    revalidatePath("/erp/finance/gst");
    return { ok: true, message: "GST pack saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function markGstReturnFiled(
  _prev: ErpFinanceState,
  formData: FormData,
): Promise<ErpFinanceState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const periodMonth = trimRequired(formData.get("period_month"), "Month");
    const confirmationUrl = optionalTrim(formData.get("filed_confirmation_url"));

    const { error } = await admin
      .from("gst_return_packs")
      .update({
        status: "filed",
        filed_at: new Date().toISOString(),
        filed_confirmation_url: confirmationUrl,
      })
      .eq("property_id", pid)
      .eq("period_month", periodMonth);
    if (error) throw new Error(error.message);

    revalidatePath("/erp/finance/gst");
    return { ok: true, message: "Marked filed in BITS." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
