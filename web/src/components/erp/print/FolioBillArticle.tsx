import {
  FiscalLetterhead,
  FiscalPayBlock,
  type FiscalPropertyChrome,
} from "@/components/erp/print/FiscalLetterhead";
import { RoomTaxInvoiceTable } from "@/components/erp/print/RoomTaxInvoice";
import { foodBillLabel } from "@/lib/folio/bill-kinds";
import { paperDocNo } from "@/lib/hotel-doc-no";
import type { FolioBillView } from "@/lib/folio/load-folio-bill-view";
import { amountInWordsPayable } from "@/lib/print/amount-in-words";

export function folioLetterheadProperty(view: FolioBillView): FiscalPropertyChrome {
  return {
    name: view.property.name,
    legal_name: view.property.legal_name,
    address: view.property.address,
    phone: view.property.phone,
    whatsapp: view.property.whatsapp,
    email: view.property.email,
    website: view.property.website,
    tax_id: view.property.tax_id,
    logo_public_id: view.property.logo_public_id,
    tagline: view.property.tagline,
  };
}

export function FolioBillArticle({
  view,
  paper = "folio",
  paperNo,
}: {
  view: FolioBillView;
  /** Folio is the working bill. The room tax invoice is a later document. */
  paper?: "folio" | "tax";
  paperNo?: string | null;
}) {
  const hotel = view.property.name?.trim() || "Hotel";
  const number =
    paper === "tax" ? paperNo?.trim() || "—" : paperDocNo(view.folioNo, view.bill);
  const kind =
    paper === "tax"
      ? "Room tax invoice"
      : view.bill === "room"
        ? "Room bill"
        : view.bill === "fnb"
          ? foodBillLabel(view.mealPlanCode)
          : "Master bill";

  return (
    <article className="folio-a4 fiscal-invoice-sheet doc-print-sheet flex w-[210mm] min-h-[297mm] flex-col bg-white px-[12mm] py-[8mm] text-[#1a1410] shadow-[0_16px_40px_rgba(26,20,16,0.16)] print:shadow-none">
      <FiscalLetterhead
        compact
        property={folioLetterheadProperty(view)}
        kind={kind}
        title={number}
        meta={[
          { label: "Date", value: view.issueDate || "—" },
          { label: "Currency", value: "Nu (BTN)" },
        ]}
      />

      <p className="mt-1.5 text-[11px] leading-tight">
        <Fact label="Guest" value={view.guestName} />
        <Fact label="Agent" value={view.agentName || "—"} />
        {view.payerLabel ? <Fact label="Pays" value={view.payerLabel} /> : null}
        <Fact label="Rooms" value={view.roomsLabel} />
        <Fact label="Pax" value={view.guestCountLabel} />
        {view.identityNo !== "—" ? <Fact label={view.identityType} value={view.identityNo} /> : null}
      </p>

      {view.invoice.rows.length > 0 ? (
        <RoomTaxInvoiceTable
          bill={view.invoice}
          serviceChargeRate={view.serviceChargeRate}
          gstRate={view.gstRate}
        />
      ) : (
        <p className="mt-4 text-sm">No lines on this folio yet.</p>
      )}

      <p className="mt-2 text-[11px] leading-snug">
        <span className="font-semibold">Amount payable (in words)</span>
        <span className="mt-0.5 block uppercase">{amountInWordsPayable(view.invoice.net)}</span>
      </p>

      <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 text-[11px]">
        <SignLine
          title="Bill prepared by"
          name={view.preparedBy}
          signature={view.preparedSignature}
        />
        <SignLine
          title="Authorized signatory"
          name={view.signatoryName}
          signature={view.signatorySignature}
        />
        <SignLine title="Printed by" name={view.preparedBy} />
        <div>
          <p className="font-semibold">For, {hotel}</p>
        </div>
      </section>

      {view.bill === "master" ? (
        <FiscalPayBlock banks={view.banks} qrDataUrl={view.bankQr} prominent />
      ) : null}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="mr-3 inline-block">
      <span className="text-[#5c534c]">{label}</span>
      <span className="px-1">:</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function SignLine({
  title,
  name,
  signature,
}: {
  title: string;
  name?: string | null;
  signature?: string | null;
}) {
  return (
    <div>
      <div className="flex h-10 items-end">
        {signature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signature} alt="" className="h-9 max-w-[180px] object-contain object-left" />
        ) : null}
      </div>
      <div className="border-b border-[#1a1410]" />
      <p className="mt-0.5">
        {title}
        {name ? <span className="font-medium"> · {name}</span> : null}
      </p>
    </div>
  );
}
