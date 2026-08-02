"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  buildBalanceSheet,
  buildGstReport,
  buildProfitAndLoss,
  buildTrialBalance,
  createAndPostJournal,
  reverseJournal,
} from "@/lib/accounting";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated, requireDeskRole, requireMoneyDesk } from "@/lib/desk-auth";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type AccountingActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidateAccounting() {
  revalidatePath("/erp/finance");
  revalidatePath("/erp/finance/accounting");
  revalidatePath("/erp/finance/reports");
  revalidatePath("/erp/finance/gst");
  revalidatePath("/erp/finance/setup");
}

export async function createManualJournal(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const journalDate = trimRequired(formData.get("journal_date"), "Date");
    const memo = optionalTrim(formData.get("memo")) ?? "Manual journal";

    const debitAccountId = trimRequired(
      formData.get("debit_account_id"),
      "Debit account",
    );
    const creditAccountId = trimRequired(
      formData.get("credit_account_id"),
      "Credit account",
    );
    const amount = roundBtn(
      Number(String(formData.get("amount_btn") ?? "").replace(/,/g, "")),
    );
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be positive.");
    }

    const journalId = await createAndPostJournal(admin, propertyId, {
      journalDate,
      journalKind: "general",
      memo,
      lines: [
        {
          accountId: debitAccountId,
          description: memo,
          debitBtn: amount,
          creditBtn: 0,
        },
        {
          accountId: creditAccountId,
          description: memo,
          debitBtn: 0,
          creditBtn: amount,
        },
      ],
      createdBy: "desk",
    });

    await writeAuditEvent(admin, {
      propertyId,
      action: "accounting.journal.create",
      entityType: "accounting_journals",
      entityId: journalId,
      summary: `Manual journal ${amount} Nu`,
    });

    revalidateAccounting();
    return { ok: true, message: "Journal posted." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not post journal.",
    };
  }
}

export async function reversePostedJournal(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const journalId = trimRequired(formData.get("journal_id"), "Journal");

    const { data: journal } = await admin
      .from("accounting_journals")
      .select("id, property_id")
      .eq("id", journalId)
      .single();
    if (!journal) throw new Error("Journal not found.");
    assertDeskProperty(propertyId, journal.property_id as string, "Journal");

    await reverseJournal(admin, propertyId, journalId, "desk");
    revalidateAccounting();
    return { ok: true, message: "Journal reversed." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reverse journal.",
    };
  }
}

export async function saveOpeningBalanceDraft(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const effectiveDate = trimRequired(
      formData.get("effective_date"),
      "Effective date",
    );
    const notes = optionalTrim(formData.get("notes"));

    const { data: existing } = await admin
      .from("accounting_opening_balances")
      .select("id, status")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (existing?.status === "posted") {
      throw new Error("Opening balances are already posted.");
    }

    let openingId = existing?.id as string | undefined;
    if (openingId) {
      await admin
        .from("accounting_opening_balances")
        .update({ effective_date: effectiveDate, notes, status: "draft" })
        .eq("id", openingId);
      await admin
        .from("accounting_opening_balance_lines")
        .delete()
        .eq("opening_balance_id", openingId);
    } else {
      const { data, error } = await admin
        .from("accounting_opening_balances")
        .insert({
          property_id: propertyId,
          effective_date: effectiveDate,
          notes,
          status: "draft",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error("Could not create opening balance.");
      openingId = data.id as string;
    }

    const accountIds = formData.getAll("account_id").map(String);
    const debits = formData.getAll("debit_btn").map(String);
    const credits = formData.getAll("credit_btn").map(String);
    const lines = accountIds
      .map((accountId, index) => {
        const debit = roundBtn(Number(debits[index] || 0));
        const credit = roundBtn(Number(credits[index] || 0));
        if (debit === 0 && credit === 0) return null;
        return {
          opening_balance_id: openingId as string,
          property_id: propertyId,
          account_id: accountId,
          debit_btn: debit,
          credit_btn: credit,
        };
      })
      .filter(
        (line): line is {
          opening_balance_id: string;
          property_id: string;
          account_id: string;
          debit_btn: number;
          credit_btn: number;
        } => line != null,
      );

    if (lines.length) {
      const { error } = await admin
        .from("accounting_opening_balance_lines")
        .insert(lines);
      if (error) throw new Error(error.message);
    }

    revalidateAccounting();
    return { ok: true, message: "Opening balance draft saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save opening balances.",
    };
  }
}

export async function postOpeningBalances(
  _prev: AccountingActionState,
  _formData: FormData,
): Promise<AccountingActionState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: opening } = await admin
      .from("accounting_opening_balances")
      .select("id, effective_date, status")
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!opening) throw new Error("Save a draft opening balance first.");
    if (opening.status === "posted") {
      throw new Error("Opening balances already posted.");
    }

    const { data: lines } = await admin
      .from("accounting_opening_balance_lines")
      .select("account_id, debit_btn, credit_btn")
      .eq("opening_balance_id", opening.id);

    const journalLines = (lines ?? [])
      .filter(
        (line) => Number(line.debit_btn) > 0 || Number(line.credit_btn) > 0,
      )
      .map((line) => ({
        accountId: line.account_id as string,
        description: "Opening balance",
        debitBtn: Number(line.debit_btn),
        creditBtn: Number(line.credit_btn),
      }));

    if (!journalLines.length) {
      throw new Error("Add at least one opening balance line.");
    }

    const debit = roundBtn(
      journalLines.reduce((s, l) => s + l.debitBtn, 0),
    );
    const credit = roundBtn(
      journalLines.reduce((s, l) => s + l.creditBtn, 0),
    );
    if (debit !== credit) {
      throw new Error(`Opening balances unbalanced: debit ${debit} credit ${credit}`);
    }

    const journalId = await createAndPostJournal(admin, propertyId, {
      journalDate: opening.effective_date as string,
      journalKind: "opening",
      memo: "Opening balances",
      sourceTable: "accounting_opening_balances",
      sourceId: opening.id as string,
      sourceEvent: "opening.post",
      lines: journalLines,
      createdBy: "desk",
    });

    await admin
      .from("accounting_opening_balances")
      .update({
        status: "posted",
        journal_id: journalId,
        approved_at: new Date().toISOString(),
        approved_by: "desk",
      })
      .eq("id", opening.id);

    await writeAuditEvent(admin, {
      propertyId,
      action: "accounting.opening.post",
      entityType: "accounting_opening_balances",
      entityId: opening.id as string,
      summary: `Opening balances posted as of ${opening.effective_date}`,
    });

    revalidateAccounting();
    return { ok: true, message: "Opening balances posted to the ledger." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not post opening balances.",
    };
  }
}

export async function toggleCloseChecklistItem(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const periodId = trimRequired(formData.get("period_id"), "Period");
    const itemKey = trimRequired(formData.get("item_key"), "Item");
    const label = trimRequired(formData.get("label"), "Label");
    const done = formData.get("is_done") === "1";

    const { data: period } = await admin
      .from("accounting_periods")
      .select("id, property_id")
      .eq("id", periodId)
      .single();
    if (!period) throw new Error("Period not found.");
    assertDeskProperty(propertyId, period.property_id as string, "Period");

    const { error } = await admin.from("accounting_close_checklists").upsert(
      {
        property_id: propertyId,
        period_id: periodId,
        item_key: itemKey,
        label,
        is_done: done,
        done_at: done ? new Date().toISOString() : null,
        done_by: done ? "desk" : null,
      },
      { onConflict: "period_id,item_key" },
    );
    if (error) throw new Error(error.message);

    revalidateAccounting();
    return { ok: true, message: done ? "Marked done." : "Marked open." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not update checklist.",
    };
  }
}

export async function closeAccountingPeriod(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  try {
    await requireDeskRole(["gm", "owner"]);
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const periodId = trimRequired(formData.get("period_id"), "Period");

    const { data: period } = await admin
      .from("accounting_periods")
      .select("id, property_id, status")
      .eq("id", periodId)
      .single();
    if (!period) throw new Error("Period not found.");
    assertDeskProperty(propertyId, period.property_id as string, "Period");

    const { data: errors } = await admin
      .from("accounting_posting_events")
      .select("id")
      .eq("property_id", propertyId)
      .eq("status", "error")
      .limit(1);
    if ((errors ?? []).length > 0) {
      throw new Error("Resolve posting errors before closing the period.");
    }

    const { data: checklist } = await admin
      .from("accounting_close_checklists")
      .select("is_done")
      .eq("period_id", periodId);
    if ((checklist ?? []).length === 0 || checklist?.some((c) => !c.is_done)) {
      throw new Error("Complete the close checklist first.");
    }

    const { error } = await admin
      .from("accounting_periods")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: "desk",
      })
      .eq("id", periodId)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "accounting.period.close",
      entityType: "accounting_periods",
      entityId: periodId,
      summary: "Accounting period closed",
    });

    revalidateAccounting();
    return { ok: true, message: "Period closed." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not close period.",
    };
  }
}

export async function ensureCloseChecklist(
  periodId: string,
): Promise<void> {
  if (!(await isDeskAuthenticated())) return;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const items = [
    {
      key: "night_audit",
      label: "Night audit clean for the period (no open blockers)",
    },
    {
      key: "posting_errors",
      label: "All ledger posting errors resolved",
    },
    {
      key: "bank_recon",
      label: "Bank statement matched — unmatched queue empty",
    },
    {
      key: "ar_review",
      label: "City ledger / agent AR reviewed (who still owes)",
    },
    {
      key: "gst_review",
      label: "GST pack A–E checked — ready to file in BITS",
    },
    {
      key: "payroll",
      label: "Payroll finalized and payslips paid or held intentionally",
    },
    {
      key: "ap_bills",
      label: "Vendor bills paid or noted as intentional AP",
    },
    {
      key: "statements",
      label: "Preview P&L, trial balance, and balance sheet",
    },
    {
      key: "lock",
      label: "Ready to lock the accounting period",
    },
  ];
  await admin.from("accounting_close_checklists").upsert(
    items.map((item) => ({
      property_id: propertyId,
      period_id: periodId,
      item_key: item.key,
      label: item.label,
    })),
    { onConflict: "period_id,item_key", ignoreDuplicates: true },
  );
}

/** Report helpers used by pages + export route. */
export async function loadFinanceReports(
  from: string,
  to: string,
) {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [pnl, trial, balance, gst] = await Promise.all([
    buildProfitAndLoss(admin, propertyId, from, to),
    buildTrialBalance(admin, propertyId, from, to),
    buildBalanceSheet(admin, propertyId, to),
    buildGstReport(admin, propertyId, from, to),
  ]);
  return { propertyId, pnl, trial, balance, gst };
}
