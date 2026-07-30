import {
  FolioReceipt,
  type FolioReceiptData,
  type ReceiptLine,
} from "@/components/erp/FolioReceipt";
import { PrintButton } from "@/components/erp/PrintButton";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Receipt | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function FolioReceiptPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: folio } = await admin
    .from("folios")
    .select(
      "id, label, status, booking_id, created_at, folio_lines(description, amount_btn, total_btn, gst_btn, service_charge_btn, source_type, status)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!folio) notFound();

  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);
  if (!property) notFound();

  const rawLines = ((folio.folio_lines as {
    description: string;
    amount_btn: number;
    total_btn: number;
    gst_btn: number;
    service_charge_btn?: number;
    source_type: string;
    status: string;
  }[] | null) ?? []).filter((line) => line.status === "posted");

  const lines: ReceiptLine[] = rawLines.map((line) => {
    const isPayment =
      line.source_type === "payment" || line.source_type === "deposit";
    return {
      description: line.description,
      amount: Number(line.total_btn),
      gst: Number(line.gst_btn ?? 0),
      serviceCharge: Number(line.service_charge_btn ?? 0),
      isPayment,
    };
  });

  const data: FolioReceiptData = {
    folioId: folio.id as string,
    label: (folio.label as string) ?? "Folio",
    bookingId: (folio.booking_id as string | null) ?? null,
    createdAt: (folio.created_at as string) ?? new Date().toISOString(),
    lines,
  };

  return (
    <div className="erp mx-auto w-full max-w-[820px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Folio receipt
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {data.label}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/erp/folios/${data.folioId}`}
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
          >
            Back to folio
          </a>
          <PrintButton label="Print receipt" />
        </div>
      </div>

      <FolioReceipt
        data={data}
        property={{
          name: property.name,
          legal_name: property.legal_name,
          address: property.address,
          phone: property.phone,
          email: property.email,
          tax_id: property.tax_id,
          logo_public_id: property.logo_public_id,
        }}
        design={property.doc_receipt}
      />
    </div>
  );
}
