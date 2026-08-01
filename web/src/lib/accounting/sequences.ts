import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Atomically allocate the next value for a property-scoped sequence kind.
 * Uses Postgres `next_property_sequence` (row-locked upsert).
 */
export async function nextPropertySequence(
  admin: Admin,
  propertyId: string,
  kind: string,
): Promise<number> {
  const { data, error } = await admin.rpc("next_property_sequence", {
    p_property_id: propertyId,
    p_kind: kind,
  });
  if (error || data == null) {
    throw new Error(error?.message ?? "Could not allocate sequence.");
  }
  return Number(data);
}

/** Journal number: JYYYYMM-#### using a locked monthly sequence. */
export async function allocateJournalNo(
  admin: Admin,
  propertyId: string,
  journalDate: string,
): Promise<string> {
  const yyyymm = journalDate.replaceAll("-", "").slice(0, 6);
  const prefix = `J${yyyymm}`;
  const seq = await nextPropertySequence(admin, propertyId, `journal:${yyyymm}`);
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export type FiscalDocKind = "invoice" | "receipt" | "credit_note";

/** Fiscal document number: INV-YYYY-#### or RCP-YYYY-#### (gapless per property/year). */
export async function allocateFiscalDocNo(
  admin: Admin,
  propertyId: string,
  kind: FiscalDocKind,
  issueDate: string,
): Promise<{ docNo: string; sequenceNo: number; fiscalYear: number }> {
  const year = issueDate.slice(0, 4);
  const prefix =
    kind === "invoice" ? "INV" : kind === "receipt" ? "RCP" : "CN";
  const seq = await nextPropertySequence(admin, propertyId, `${kind}:${year}`);
  return {
    docNo: `${prefix}-${year}-${String(seq).padStart(4, "0")}`,
    sequenceNo: seq,
    fiscalYear: Number(year),
  };
}
