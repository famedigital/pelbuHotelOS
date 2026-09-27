"use client";

import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { amountInWordsNu } from "@/lib/print/amount-in-words";
import { formatGuestBtn } from "@/lib/pricing";
import type { PropertyDocumentDesign } from "@/lib/property-settings";
import {
  FiscalDocFooter,
  FiscalLetterhead,
  FiscalParties,
  FiscalSignOff,
  FiscalStayStrip,
  FiscalTotalsBlock,
} from "@/components/erp/print/FiscalLetterhead";

export type FastBookInvoiceData = {
  bookingId: string;
  confirmationCode?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  guestName: string;
  agentLabel?: string;
  sourceLabel?: string;
  paymentLabel?: string;
  lines: {
    name: string;
    code: string;
    qty: number;
    kind: string;
    /** Unit rate Nu when known (proforma with money). */
    rateBtn?: number | null;
    /** Line total Nu when known. */
    amountBtn?: number | null;
  }[];
  /** Package / quoted stay total Nu — enables PROFORMA money block. */
  totalBtn?: number | null;
};

type InvoiceProperty = {
  name: string;
  legal_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_id?: string | null;
  logo_public_id?: string | null;
};

function fmtIso(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Desk proforma — same A4 letterhead as the tax invoice. Not a fiscal GST INV.
 */
export function FastBookInvoice({
  data,
  property,
  title: titleOverride,
  printId = "print-booking-note",
}: {
  data: FastBookInvoiceData;
  property?: InvoiceProperty;
  design?: PropertyDocumentDesign;
  title?: string;
  printId?: string;
}) {
  const brandName = property?.name ?? "Hotel";
  const legalName = property?.legal_name?.trim() || brandName;
  const title = titleOverride ?? "PROFORMA";
  const conf = bookingConfirmationLabel({
    confirmationCode: data.confirmationCode,
    bookingId: data.bookingId,
  });
  const lineAmounts = data.lines.map((l) => {
    const amount =
      l.amountBtn != null
        ? Number(l.amountBtn)
        : l.rateBtn != null
          ? Number(l.rateBtn) * Number(l.qty || 1) * Math.max(1, data.nights || 1)
          : null;
    return { ...l, amount };
  });
  const computedTotal = lineAmounts.reduce(
    (s, l) => s + (l.amount ?? 0),
    0,
  );
  const totalBtn =
    data.totalBtn != null && data.totalBtn > 0
      ? Number(data.totalBtn)
      : computedTotal > 0
        ? computedTotal
        : null;
  const showMoney = totalBtn != null && totalBtn > 0;

  return (
      <section
        id={printId}
        aria-label={title}
        className="erp doc-print-sheet fiscal-invoice-sheet mx-auto max-w-[210mm] border border-[#d8d0c6] bg-white px-[12mm] py-[10mm] text-[#1a1410] print:border-0 print:px-0 print:py-0"
      >
        <FiscalLetterhead
          property={{
            name: brandName,
            legal_name: legalName,
            address: property?.address,
            phone: property?.phone,
            email: property?.email,
            tax_id: property?.tax_id,
            logo_public_id: property?.logo_public_id,
          }}
          kind="Proforma"
          title={title}
          meta={[
            { label: "Date", value: fmtIso(data.checkIn) },
            { label: "Conf", value: conf },
            { label: "Nights", value: String(data.nights || "—") },
            { label: "Currency", value: "Nu (BTN)" },
          ]}
        />
        <FiscalParties
          billTo={data.guestName || "Guest"}
          billToDetail={
            data.agentLabel ? <p>Agent: {data.agentLabel}</p> : null
          }
          from={brandName}
          fromDetail={
            property?.address ? <p>{property.address}</p> : undefined
          }
        />
        <FiscalStayStrip
          items={[
            {
              label: "Stay",
              value: `${fmtIso(data.checkIn)} â†’ ${fmtIso(data.checkOut)}`,
            },
            {
              label: "Pax",
              value: `${data.adults || "—"} adults`,
            },
            ...(data.agentLabel
              ? [{ label: "Agent", value: data.agentLabel }]
              : []),
          ]}
        />
        <table className="fiscal-invoice-lines mt-2.5 w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#1a1410] text-left text-[10px] tracking-[0.08em] text-white uppercase">
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Description</th>
              <th className="px-2 py-1.5 text-right">Qty</th>
              <th className="px-2 py-1.5 text-right">Rate</th>
              <th className="px-2 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineAmounts.map((l, i) => (
              <tr key={`${l.code}-${l.name}`} className="border-b border-[#ddd6cc]">
                <td className="px-2 py-1.5 tabular-nums text-[#5c534c]">
                  {i + 1}
                </td>
                <td className="px-2 py-1.5 font-semibold">
                  {l.name}
                  <span className="mt-0.5 block text-[10.5px] font-normal text-[#5c534c]">
                    {l.code} Â· {data.nights} night(s)
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.qty}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {l.rateBtn != null ? formatGuestBtn(l.rateBtn) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                  {l.amount != null ? formatGuestBtn(l.amount) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {showMoney && totalBtn != null ? (
          <FiscalTotalsBlock
            subtotal={totalBtn}
            serviceCharge={0}
            gst={0}
            total={totalBtn}
          />
        ) : null}
        <p className="mt-2 text-[11px] text-[#5c534c]">
          Proforma estimate only — not a tax invoice. Fiscal INV issued from folio
          after stay charges post.
          {showMoney && totalBtn != null ? ` ${amountInWordsNu(totalBtn)}` : ""}
        </p>
        <FiscalSignOff hotelName={brandName} />
        <FiscalDocFooter
          property={{ name: brandName, address: property?.address }}
          thankYou="This proforma is subject to confirmation and availability."
        />
      </section>
    );
}
