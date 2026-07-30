import "server-only";
import { roundBtn } from "@/lib/pricing";
import { assertBalancedLines } from "@/lib/accounting/balance";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AccountingAccount,
  AccountingPeriod,
  JournalDraft,
  JournalLineInput,
  PostingResult,
} from "@/lib/accounting/types";

export { assertBalancedLines } from "@/lib/accounting/balance";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function money(n: number): number {
  return roundBtn(n);
}

export async function resolvePeriodForDate(
  admin: Admin,
  propertyId: string,
  journalDate: string,
): Promise<AccountingPeriod | null> {
  const { data } = await admin
    .from("accounting_periods")
    .select("id, label, starts_on, ends_on, status, fiscal_year_id")
    .eq("property_id", propertyId)
    .lte("starts_on", journalDate)
    .gte("ends_on", journalDate)
    .maybeSingle();
  return (data as AccountingPeriod | null) ?? null;
}

export async function getAccountBySystemKey(
  admin: Admin,
  propertyId: string,
  systemKey: string,
): Promise<AccountingAccount | null> {
  const { data } = await admin
    .from("accounting_accounts")
    .select(
      "id, code, name, account_type, normal_balance, system_key, is_active, is_postable",
    )
    .eq("property_id", propertyId)
    .eq("system_key", systemKey)
    .maybeSingle();
  return (data as AccountingAccount | null) ?? null;
}

export async function getDepartmentIdByCode(
  admin: Admin,
  propertyId: string,
  code: string | null | undefined,
): Promise<string | null> {
  if (!code) return null;
  const { data } = await admin
    .from("accounting_departments")
    .select("id")
    .eq("property_id", propertyId)
    .eq("code", code)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function nextJournalNo(
  admin: Admin,
  propertyId: string,
  journalDate: string,
): Promise<string> {
  const prefix = `J${journalDate.replaceAll("-", "").slice(0, 6)}`;
  const { count } = await admin
    .from("accounting_journals")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .like("journal_no", `${prefix}%`);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `${prefix}-${seq}`;
}

/**
 * Creates a draft journal + lines, then posts it in one transaction-ish flow.
 * Callers should use enqueuePostingEvent for idempotent operational posts.
 */
export async function createAndPostJournal(
  admin: Admin,
  propertyId: string,
  draft: JournalDraft,
): Promise<string> {
  assertBalancedLines(draft.lines);

  const period = await resolvePeriodForDate(admin, propertyId, draft.journalDate);
  if (period?.status === "closed") {
    throw new Error(`Period ${period.label} is closed.`);
  }

  const journalNo = await nextJournalNo(admin, propertyId, draft.journalDate);

  const { data: journal, error: journalError } = await admin
    .from("accounting_journals")
    .insert({
      property_id: propertyId,
      period_id: period?.id ?? null,
      journal_no: journalNo,
      journal_date: draft.journalDate,
      journal_kind: draft.journalKind,
      status: "draft",
      memo: draft.memo ?? null,
      source_table: draft.sourceTable ?? null,
      source_id: draft.sourceId ?? null,
      source_event: draft.sourceEvent ?? null,
      created_by: draft.createdBy ?? "desk",
    })
    .select("id")
    .single();

  if (journalError || !journal) {
    throw new Error(journalError?.message ?? "Could not create journal.");
  }

  const journalId = journal.id as string;
  const lineRows = draft.lines.map((line, index) => ({
    property_id: propertyId,
    journal_id: journalId,
    line_no: index + 1,
    account_id: line.accountId,
    department_id: line.departmentId ?? null,
    description: line.description ?? null,
    debit_btn: money(line.debitBtn),
    credit_btn: money(line.creditBtn),
  }));

  const { error: linesError } = await admin
    .from("accounting_journal_lines")
    .insert(lineRows);
  if (linesError) {
    await admin.from("accounting_journals").delete().eq("id", journalId);
    throw new Error(linesError.message);
  }

  const { error: postError } = await admin
    .from("accounting_journals")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_by: draft.createdBy ?? "desk",
    })
    .eq("id", journalId);

  if (postError) {
    throw new Error(postError.message);
  }

  return journalId;
}

export async function reverseJournal(
  admin: Admin,
  propertyId: string,
  journalId: string,
  reversedBy = "desk",
): Promise<string> {
  const { data: original } = await admin
    .from("accounting_journals")
    .select("id, journal_date, journal_kind, memo, status")
    .eq("id", journalId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!original) throw new Error("Journal not found.");
  if (original.status !== "posted") {
    throw new Error("Only posted journals can be reversed.");
  }

  const { data: lines } = await admin
    .from("accounting_journal_lines")
    .select("account_id, department_id, description, debit_btn, credit_btn")
    .eq("journal_id", journalId)
    .order("line_no");

  const reversalLines: JournalLineInput[] = (lines ?? []).map((line) => ({
    accountId: line.account_id as string,
    departmentId: (line.department_id as string | null) ?? null,
    description: `Reversal: ${(line.description as string | null) ?? ""}`.trim(),
    debitBtn: Number(line.credit_btn ?? 0),
    creditBtn: Number(line.debit_btn ?? 0),
  }));

  const reversalId = await createAndPostJournal(admin, propertyId, {
    journalDate: original.journal_date as string,
    journalKind: "reversal",
    memo: `Reversal of journal ${journalId}`,
    sourceTable: "accounting_journals",
    sourceId: journalId,
    sourceEvent: "reversal",
    lines: reversalLines,
    createdBy: reversedBy,
  });

  await admin
    .from("accounting_journals")
    .update({ status: "reversed", reverses_journal_id: reversalId })
    .eq("id", journalId);

  return reversalId;
}

/** Simple two-sided post using system keys from posting rules. */
export async function postSimpleEvent(
  admin: Admin,
  propertyId: string,
  input: {
    eventType: string;
    sourceTable: string;
    sourceId: string;
    journalDate: string;
    amountBtn: number;
    gstBtn?: number;
    memo?: string;
    journalKind?: JournalDraft["journalKind"];
    paymentSide?: "debit_cash" | "credit_cash";
  },
): Promise<PostingResult> {
  const amount = money(input.amountBtn);
  if (amount <= 0) return { ok: false, error: "Amount must be positive." };

  const { data: existing } = await admin
    .from("accounting_posting_events")
    .select("id, status, journal_id")
    .eq("property_id", propertyId)
    .eq("source_table", input.sourceTable)
    .eq("source_id", input.sourceId)
    .eq("event_type", input.eventType)
    .maybeSingle();

  if (existing?.status === "posted" && existing.journal_id) {
    return { ok: true, journalId: existing.journal_id as string, skipped: true };
  }

  const eventId =
    (existing?.id as string | undefined) ??
    (
      await admin
        .from("accounting_posting_events")
        .insert({
          property_id: propertyId,
          source_table: input.sourceTable,
          source_id: input.sourceId,
          event_type: input.eventType,
          status: "pending",
          payload: input,
        })
        .select("id")
        .single()
    ).data?.id;

  try {
    const { data: rule } = await admin
      .from("accounting_posting_rules")
      .select("debit_system_key, credit_system_key, department_code, is_active")
      .eq("property_id", propertyId)
      .eq("event_type", input.eventType)
      .maybeSingle();

    if (!rule || rule.is_active === false) {
      throw new Error(`No active posting rule for ${input.eventType}`);
    }

    const debitAccount = await getAccountBySystemKey(
      admin,
      propertyId,
      rule.debit_system_key as string,
    );
    const creditAccount = await getAccountBySystemKey(
      admin,
      propertyId,
      rule.credit_system_key as string,
    );
    if (!debitAccount || !creditAccount) {
      throw new Error(`Missing accounts for ${input.eventType}`);
    }

    const departmentId = await getDepartmentIdByCode(
      admin,
      propertyId,
      rule.department_code as string | null,
    );

    const gst = money(input.gstBtn ?? 0);
    const net = money(Math.max(amount - gst, 0));
    const lines: JournalLineInput[] = [];

    // Expense with GST input: expense (net) + gst_input, credit cash/bank (gross)
    if (input.eventType.startsWith("expense.") && gst > 0) {
      const gstInput = await getAccountBySystemKey(admin, propertyId, "gst_input");
      if (!gstInput) throw new Error("GST input account missing.");
      lines.push({
        accountId: debitAccount.id,
        departmentId,
        description: input.memo,
        debitBtn: net > 0 ? net : amount,
        creditBtn: 0,
      });
      if (net > 0) {
        lines.push({
          accountId: gstInput.id,
          description: "GST input",
          debitBtn: gst,
          creditBtn: 0,
        });
      }
      lines.push({
        accountId: creditAccount.id,
        description: input.memo,
        debitBtn: 0,
        creditBtn: amount,
      });
    } else if (
      input.eventType.startsWith("folio_line.") &&
      gst > 0
    ) {
      // AR gross, revenue net, GST output
      const gstOutput = await getAccountBySystemKey(
        admin,
        propertyId,
        "gst_output",
      );
      if (!gstOutput) throw new Error("GST output account missing.");
      lines.push({
        accountId: debitAccount.id,
        departmentId,
        description: input.memo,
        debitBtn: amount,
        creditBtn: 0,
      });
      lines.push({
        accountId: creditAccount.id,
        departmentId,
        description: input.memo,
        debitBtn: 0,
        creditBtn: net > 0 ? net : amount,
      });
      if (net > 0) {
        lines.push({
          accountId: gstOutput.id,
          description: "GST output",
          debitBtn: 0,
          creditBtn: gst,
        });
      }
    } else {
      lines.push({
        accountId: debitAccount.id,
        departmentId,
        description: input.memo,
        debitBtn: amount,
        creditBtn: 0,
      });
      lines.push({
        accountId: creditAccount.id,
        departmentId,
        description: input.memo,
        debitBtn: 0,
        creditBtn: amount,
      });
    }

    const journalId = await createAndPostJournal(admin, propertyId, {
      journalDate: input.journalDate,
      journalKind: input.journalKind ?? "general",
      memo: input.memo,
      sourceTable: input.sourceTable,
      sourceId: input.sourceId,
      sourceEvent: input.eventType,
      lines,
    });

    if (eventId) {
      await admin
        .from("accounting_posting_events")
        .update({
          status: "posted",
          journal_id: journalId,
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", eventId);
    }

    return { ok: true, journalId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Posting failed.";
    if (eventId) {
      await admin
        .from("accounting_posting_events")
        .update({
          status: "error",
          error_message: message,
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventId);
    }
    return { ok: false, error: message };
  }
}
