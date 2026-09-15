import { BankProofQueue, type PendingLinkRow, type PendingPaymentRow } from "@/components/erp/finance/BankProofQueue";
import { FinanceShell } from "@/components/erp/finance/FinanceShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Bank proofs",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function FinanceBankProofsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [{ data: payments }, { data: links }] = await Promise.all([
    admin
      .from("payments")
      .select(
        "id, amount_btn, method, reference, proof_url, proof_submitted_at, folio_id, created_at",
      )
      .eq("property_id", propertyId)
      .eq("confirmation_status", "pending_bank")
      .order("proof_submitted_at", { ascending: false })
      .limit(50),
    admin
      .from("payment_links")
      .select(
        "id, amount_btn, proof_url, proof_reference, proof_submitted_at, booking_id, folio_id",
      )
      .eq("property_id", propertyId)
      .eq("status", "pending_bank")
      .order("proof_submitted_at", { ascending: false })
      .limit(50),
  ]);

  const paymentRows: PendingPaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id as string,
    amount_btn: Number(p.amount_btn),
    method: p.method as string,
    reference: (p.reference as string | null) ?? null,
    proof_url: (p.proof_url as string | null) ?? null,
    proof_submitted_at: (p.proof_submitted_at as string | null) ?? null,
    folio_id: (p.folio_id as string | null) ?? null,
    created_at: p.created_at as string,
  }));

  const linkRows: PendingLinkRow[] = (links ?? []).map((l) => ({
    id: l.id as string,
    amount_btn: Number(l.amount_btn),
    proof_url: (l.proof_url as string | null) ?? null,
    proof_reference: (l.proof_reference as string | null) ?? null,
    proof_submitted_at: (l.proof_submitted_at as string | null) ?? null,
    booking_id: (l.booking_id as string | null) ?? null,
    folio_id: (l.folio_id as string | null) ?? null,
  }));

  return (
    <FinanceShell
      title="Bank payment proofs"
      description="QR / NEFT screenshot queue — confirm when funds land, then share receipt."
    >
      <BankProofQueue payments={paymentRows} links={linkRows} />
    </FinanceShell>
  );
}
