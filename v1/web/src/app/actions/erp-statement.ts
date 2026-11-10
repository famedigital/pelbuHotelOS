"use server";

import { writeAuditEvent } from "@/lib/audit";
import { requireStatementDesk } from "@/lib/desk-auth";
import { BANK_TREATMENTS } from "@/lib/finance/statement-model";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type StatementState = { ok: boolean; error?: string; message?: string };

const ROLES = new Set(["operating", "owner", "related"]);
const BANKS = new Set(["bob", "bnb", "tbank", "drukpnb", "other"]);

function revalidate() {
  revalidatePath("/erp/finance");
  revalidatePath("/erp/finance/statement");
  revalidatePath("/erp/finance/rrco");
}

export async function saveFinanceAccount(
  _prev: StatementState,
  formData: FormData,
): Promise<StatementState> {
  try {
    await requireStatementDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const label = trimRequired(formData.get("label"), "Account name");
    const bankCode = trimRequired(formData.get("bank_code"), "Bank").toLowerCase();
    const role = trimRequired(formData.get("account_role"), "Role").toLowerCase();
    if (!BANKS.has(bankCode)) throw new Error("Unknown bank.");
    if (!ROLES.has(role)) throw new Error("Account role must be operating, owner, or related.");
    const opening = Number(String(formData.get("opening_balance_btn") ?? "0").replace(/,/g, ""));
    if (!Number.isFinite(opening)) throw new Error("Opening balance must be a number.");
    const { error } = await admin.from("finance_bank_accounts").insert({
      property_id: propertyId,
      label,
      bank_code: bankCode,
      account_no: optionalTrim(formData.get("account_no")),
      account_role: role,
      opening_balance_btn: roundBtn(opening),
    });
    if (error) {
      console.error("finance account insert failed", error);
      throw new Error("Could not save that account. The name may already exist.");
    }
    revalidate();
    return { ok: true, message: "Account saved." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save account." };
  }
}

export async function assignStatementAccount(
  _prev: StatementState,
  formData: FormData,
): Promise<StatementState> {
  try {
    await requireStatementDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const statementId = trimRequired(formData.get("statement_id"), "Statement");
    const accountId = trimRequired(formData.get("finance_account_id"), "Account");
    const { error } = await admin
      .from("bank_statements")
      .update({ finance_account_id: accountId })
      .eq("id", statementId)
      .eq("property_id", propertyId);
    if (error) {
      console.error("assign statement account failed", error);
      throw new Error("Could not attach that statement.");
    }
    revalidate();
    return { ok: true, message: "Statement attached to the account." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not attach statement." };
  }
}

export async function classifyBankLine(
  _prev: StatementState,
  formData: FormData,
): Promise<StatementState> {
  try {
    await requireStatementDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const bankTxnId = trimRequired(formData.get("bank_txn_id"), "Bank line");
    const category = trimRequired(formData.get("category"), "Category");
    const treatment = trimRequired(formData.get("treatment"), "Treatment");
    if (!BANK_TREATMENTS.includes(treatment as (typeof BANK_TREATMENTS)[number])) {
      throw new Error("Unknown treatment.");
    }
    const { data: txn, error: txnErr } = await admin
      .from("bank_transactions")
      .select("id")
      .eq("id", bankTxnId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (txnErr || !txn) throw new Error("Bank line not found.");
    const row = {
      property_id: propertyId,
      bank_txn_id: bankTxnId,
      category,
      treatment,
      party: optionalTrim(formData.get("party")),
      reason: optionalTrim(formData.get("reason")),
      classified_at: new Date().toISOString(),
    };
    const { error } = await admin
      .from("statement_line_classes")
      .upsert(row, { onConflict: "bank_txn_id" });
    if (error) {
      console.error("classify bank line failed", error);
      throw new Error("Could not classify that line.");
    }
    await writeAuditEvent(admin, {
      propertyId,
      action: "finance.statement.classify",
      entityType: "bank_transactions",
      entityId: bankTxnId,
      summary: `Classified bank line as ${treatment} / ${category}`,
    });
    revalidate();
    return { ok: true, message: "Line classified." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not classify." };
  }
}
