import { IssueReceiptButton } from "@/components/erp/FolioOpsForms";
import {
  FolioReceipt,
  type FolioReceiptData,
  type ReceiptLine,
} from "@/components/erp/FolioReceipt";
import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { FiscalDocEmailForm } from "@/components/erp/FiscalDocEmailForm";
import { FolioReceiptWaShare } from "@/components/erp/ReceiptShareActions";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { guestVisibleBalanceLines } from "@/lib/folio/balance";
import { buildFolioReceiptMessage } from "@/lib/pos-receipt-message";
import type { DocumentPaperSize } from "@/lib/property-settings";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FolioReceiptPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: folio } = await admin
    .from("folios")
    .select(
      "id, label, status, booking_id, created_at, property_id, folio_lines(id, description, amount_btn, total_btn, gst_btn, service_charge_btn, source_type, status, reverses_line_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!folio) notFound();
  try {
    assertDeskProperty(propertyId, folio.property_id as string, "Folio");
  } catch {
    notFound();
  }

  const property = await loadProperty(admin, propertyId);
  if (!property) notFound();

  const paper: DocumentPaperSize = "a4";
  const design = { ...property.doc_receipt, paper_size: paper };

  const { data: receiptDoc } = await admin
    .from("fiscal_documents")
    .select("id, doc_no, payment_id")
    .eq("folio_id", id)
    .eq("doc_kind", "receipt")
    .eq("status", "issued")
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestPayment } = await admin
    .from("payments")
    .select("id")
    .eq("folio_id", id)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let guestEmail: string | null = null;
  let guestName: string | null = null;
  let guestPhone: string | null = null;
  const bookingId = folio.booking_id as string | null;
  if (bookingId) {
    const { data: booking } = await admin
      .from("bookings")
      .select("contact_email, contact_name, contact_phone")
      .eq("id", bookingId)
      .maybeSingle();
    guestEmail = (booking?.contact_email as string | null) ?? null;
    guestName = (booking?.contact_name as string | null) ?? null;
    guestPhone = (booking?.contact_phone as string | null) ?? null;
  }

  const rawLines = guestVisibleBalanceLines(
    ((folio.folio_lines as {
      id: string;
      description: string;
      amount_btn: number;
      total_btn: number;
      gst_btn: number;
      service_charge_btn?: number;
      source_type: string;
      status: string;
      reverses_line_id?: string | null;
    }[] | null) ?? []).map((line) => ({
      ...line,
      total_btn: Number(line.total_btn),
      reverses_line_id: line.reverses_line_id ?? null,
    })),
  );

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
    bookingId,
    createdAt: (folio.created_at as string) ?? new Date().toISOString(),
    docNo: (receiptDoc?.doc_no as string | undefined) ?? null,
    lines,
  };

  const chargesSum = lines
    .filter((l) => !l.isPayment)
    .reduce((s, l) => s + Number(l.amount), 0);
  const paymentsSum = lines
    .filter((l) => l.isPayment)
    .reduce((s, l) => s + Math.abs(Number(l.amount)), 0);
  const waMessage = buildFolioReceiptMessage({
    propertyName: property.name,
    folioLabel: data.label,
    docNo: data.docNo,
    guestName,
    lines: lines.map((l) => ({
      description: l.description,
      totalBtn: l.amount,
      isPayment: l.isPayment,
    })),
    chargesSum,
    paymentsSum,
  });

  return (
    <div className="erp mx-auto w-full max-w-[820px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Folio receipt
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {data.label}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Guest file receipt on A4. Thermal 80mm is for the food bill, KOT, and POS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/erp/folios/${data.folioId}`}
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
          >
            Back to folio
          </a>
          <DocPrintControls defaultSize="a4" printLabel="Print receipt" />
        </div>
      </div>

      <div className="grid gap-4 print:hidden md:grid-cols-2">
        <IssueReceiptButton
          folioId={data.folioId}
          receiptNo={data.docNo}
          paymentId={
            (receiptDoc?.payment_id as string | undefined) ??
            (latestPayment?.id as string | undefined) ??
            null
          }
        />
        <FiscalDocEmailForm
          folioId={data.folioId}
          fiscalDocId={(receiptDoc?.id as string | undefined) ?? null}
          docKind="receipt"
          defaultEmail={guestEmail}
          defaultName={guestName}
          label="Email receipt"
        />
        <FolioReceiptWaShare
          messageText={waMessage}
          defaultPhone={guestPhone}
        />
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
        design={design}
      />
    </div>
  );
}
