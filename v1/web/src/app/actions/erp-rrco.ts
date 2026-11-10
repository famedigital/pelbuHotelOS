"use server";

import { writeAuditEvent } from "@/lib/audit";
import { requireTaxDesk } from "@/lib/desk-auth";
import { financeStoragePath, uploadFinanceObject } from "@/lib/finance-import/storage";
import {
  pullBooksIntoFiling,
  rebuildCanonical,
} from "@/lib/finance/rrco-pack";
import { RRCO_TREATMENTS, roundBtn } from "@/lib/finance/statement-model";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type RrcoState = { ok: boolean; error?: string; message?: string };

function revalidate() {
  revalidatePath("/erp/finance/rrco");
  revalidatePath("/erp/finance/rrco/recon");
  revalidatePath("/erp/finance/rrco/canonical");
  revalidatePath("/erp/finance/rrco/pnl");
  revalidatePath("/erp/finance/rrco/balance");
  revalidatePath("/erp/finance/rrco/trial");
  revalidatePath("/erp/finance/rrco/assessment");
}

function yearFrom(formData: FormData): number {
  const year = Number(formData.get("tax_year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Pick a tax year.");
  }
  return year;
}

export async function pullRrcoBooks(
  _prev: RrcoState,
  formData: FormData,
): Promise<RrcoState> {
  try {
    await requireTaxDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const year = yearFrom(formData);
    const count = await pullBooksIntoFiling(admin, propertyId, year);
    await writeAuditEvent(admin, {
      propertyId,
      action: "finance.rrco.pull",
      entityType: "rrco_filings",
      entityId: null,
      summary: `Pulled ${count} lines into RRCO ${year}`,
    });
    revalidate();
    return { ok: true, message: `Pulled ${count} lines into ${year}.` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not pull books." };
  }
}

export async function updateRrcoLine(
  _prev: RrcoState,
  formData: FormData,
): Promise<RrcoState> {
  try {
    await requireTaxDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const id = trimRequired(formData.get("line_id"), "Line");
    const treatment = trimRequired(formData.get("treatment"), "Treatment");
    if (!RRCO_TREATMENTS.includes(treatment as (typeof RRCO_TREATMENTS)[number])) {
      throw new Error("Unknown treatment.");
    }
    if (treatment !== "include_income" && treatment !== "include_expense" && treatment !== "salary_sheet") {
      const reason = optionalTrim(formData.get("reason"));
      if (!reason) throw new Error("A reason is required when a line is not turnover or an allowable expense.");
    }
    const { error } = await admin
      .from("rrco_lines")
      .update({
        treatment,
        category: trimRequired(formData.get("category"), "Category"),
        reason: optionalTrim(formData.get("reason")),
      })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) {
      console.error("rrco line update failed", error);
      throw new Error("Could not update that line.");
    }
    revalidate();
    return { ok: true, message: "Line updated. Rebuild canonical numbers after you finish." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update line." };
  }
}

export async function buildRrcoCanonical(
  _prev: RrcoState,
  formData: FormData,
): Promise<RrcoState> {
  try {
    await requireTaxDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const year = yearFrom(formData);
    const count = await rebuildCanonical(admin, propertyId, year);
    await writeAuditEvent(admin, {
      propertyId,
      action: "finance.rrco.canonical",
      entityType: "rrco_filings",
      entityId: null,
      summary: `Built ${count} canonical RRCO documents for ${year}`,
    });
    revalidate();
    return { ok: true, message: `Wrote ${count} canonical documents for ${year}.` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not build documents." };
  }
}

export async function saveRrcoHeader(
  _prev: RrcoState,
  formData: FormData,
): Promise<RrcoState> {
  try {
    await requireTaxDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const year = yearFrom(formData);
    const cash = Number(formData.get("cash_in_hand_btn") ?? 0);
    const tds = Number(formData.get("tds_btn") ?? 0);
    const capital = Number(formData.get("capital_btn") ?? 0);
    for (const [label, n] of [
      ["Cash in hand", cash],
      ["TDS", tds],
      ["Capital", capital],
    ] as const) {
      if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
    }
    const { error } = await admin
      .from("rrco_filings")
      .update({
        cash_in_hand_btn: roundBtn(cash),
        tds_btn: roundBtn(tds),
        capital_btn: roundBtn(capital),
        prepared_by: optionalTrim(formData.get("prepared_by")),
      })
      .eq("property_id", propertyId)
      .eq("tax_year", year)
      .eq("status", "draft");
    if (error) {
      console.error("rrco header update failed", error);
      throw new Error("Could not save the filing header.");
    }
    revalidate();
    return { ok: true, message: "Filing header saved." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save header." };
  }
}

export async function addAssessmentFile(
  _prev: RrcoState,
  formData: FormData,
): Promise<RrcoState> {
  try {
    await requireTaxDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const year = yearFrom(formData);
    const { data: filing } = await admin
      .from("rrco_filings")
      .select("id")
      .eq("property_id", propertyId)
      .eq("tax_year", year)
      .maybeSingle();
    if (!filing?.id) throw new Error("Open the RRCO year first.");
    const label = trimRequired(formData.get("label"), "Label");
    const kind = trimRequired(formData.get("kind"), "Kind");
    const allowed = new Set(["statement", "invoice", "bill", "comp_schedule", "reason", "other"]);
    if (!allowed.has(kind)) throw new Error("Unknown document kind.");
    let storagePath: string | null = null;
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const path = financeStoragePath(propertyId, "attachments", file.name || "rrco.pdf");
      await uploadFinanceObject(
        admin,
        path,
        Buffer.from(await file.arrayBuffer()),
        file.type || "application/octet-stream",
      );
      storagePath = path;
    }
    const { error } = await admin.from("rrco_assessment_files").insert({
      filing_id: filing.id,
      property_id: propertyId,
      label,
      kind,
      storage_path: storagePath,
      notes: optionalTrim(formData.get("notes")),
    });
    if (error) {
      console.error("assessment insert failed", error);
      throw new Error("Could not save the assessment file.");
    }
    revalidate();
    return { ok: true, message: "Backup saved on the assessment file." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save backup." };
  }
}
