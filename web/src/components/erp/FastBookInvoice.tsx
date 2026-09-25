"use client";

import { cloudinaryUrl } from "@/lib/cloudinary";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { amountInWordsNu } from "@/lib/print/amount-in-words";
import { formatGuestBtn } from "@/lib/pricing";
import {
  defaultDocumentDesign,
  registrationLines,
  type PropertyDocumentDesign,
} from "@/lib/property-settings";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
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

const SOURCE_LABELS: Record<string, string> = {
  owner: "Owner",
  reservation: "Reservation",
  agent: "Agent",
  mou_agent: "MoU agent",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Pay at checkout",
  prepaid: "Prepaid",
  partial: "Partial / deposit",
  on_credit: "On credit",
};

/**
 * Desk booking confirmation note — professional A4, not a fiscal GST INV.
 * Design from Settings → Documents → Invoice.
 */
export function FastBookInvoice({
  data,
  property,
  design: designProp,
  title: titleOverride,
  printId = "print-booking-note",
}: {
  data: FastBookInvoiceData;
  property?: InvoiceProperty;
  design?: PropertyDocumentDesign;
  title?: string;
  printId?: string;
}) {
  const design = designProp ?? defaultDocumentDesign("invoice");
  const sourceLabel =
    data.sourceLabel != null
      ? (SOURCE_LABELS[data.sourceLabel] ?? data.sourceLabel)
      : undefined;
  const paymentLabel =
    data.paymentLabel != null
      ? (PAYMENT_LABELS[data.paymentLabel] ?? data.paymentLabel)
      : undefined;
  const brandName = property?.name ?? "Hotel";
  const legalName = property?.legal_name?.trim() || brandName;
  const logoSrc =
    design.show_logo && property?.logo_public_id
      ? cloudinaryUrl(property.logo_public_id, { width: 180, crop: "fit" })
      : null;
  const title = titleOverride ?? design.title;
  const notes = registrationLines(design.notes_text);
  const conf = bookingConfirmationLabel({
    confirmationCode: data.confirmationCode,
    bookingId: data.bookingId,
  });
  const style = {
    ["--doc-brand" as string]: design.brand_color,
    ["--doc-accent" as string]: design.accent_color,
  } as CSSProperties;

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

  if (showMoney) {
    return (
      <section
        id={printId}
        aria-label="Proforma"
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
          title="PROFORMA"
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
              value: `${fmtIso(data.checkIn)} → ${fmtIso(data.checkOut)}`,
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
                    {l.code} · {data.nights} night(s)
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
        <FiscalTotalsBlock
          subtotal={totalBtn}
          serviceCharge={0}
          gst={0}
          total={totalBtn}
        />
        <p className="mt-2 text-[11px] text-[#5c534c]">
          Proforma estimate only — not a tax invoice. Fiscal INV issued from folio
          after stay charges post. {amountInWordsNu(totalBtn)}
        </p>
        <FiscalSignOff hotelName={brandName} />
        <FiscalDocFooter
          property={{ name: brandName, address: property?.address }}
          thankYou="This proforma is subject to confirmation and availability."
        />
      </section>
    );
  }

  return (
    <section
      id={printId}
      aria-label={title}
      style={style}
      className={cn(
        "erp doc-print-sheet mx-auto max-w-[210mm] border bg-white text-foreground",
        "px-5 py-4 text-[11px] leading-snug print:max-w-none print:rounded-none print:border-0 print:px-6 print:py-4 print:shadow-none",
        design.preset === "branded" &&
          "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--doc-accent)_10%,white)_0%,white_22%)]",
        design.preset === "compact" && "text-[10.5px]",
      )}
    >
      <header
        className="flex items-start justify-between gap-3 border-b-2 pb-2.5"
        style={{ borderColor: design.brand_color }}
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-[9px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: design.brand_color }}
          >
            {legalName}
          </p>
          <h1
            className="mt-0.5 text-lg font-semibold tracking-tight"
            style={{ color: design.brand_color }}
          >
            {title}
          </h1>
          <p className="mt-0.5 text-[10px] text-neutral-600">
            {design.header_text}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-neutral-500">
            {design.show_address && property?.address ? (
              <span>{property.address}</span>
            ) : null}
            {design.show_phone && property?.phone ? (
              <span>T {property.phone}</span>
            ) : null}
            {design.show_email && property?.email ? (
              <span>{property.email}</span>
            ) : null}
            {design.show_tax_id && property?.tax_id ? (
              <span>Tax {property.tax_id}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              className="h-12 w-auto max-w-[7rem] object-contain"
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-md text-[10px] font-bold tracking-wide text-white"
              style={{ backgroundColor: design.brand_color }}
              aria-hidden
            >
              {brandName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <p
            className="rounded px-1.5 py-0.5 text-[8px] font-semibold tracking-wider text-white uppercase"
            style={{ backgroundColor: design.accent_color }}
          >
            Not a tax inv
          </p>
        </div>
      </header>

      {design.intro_text.trim() ? (
        <p className="mt-2 text-[10px] leading-snug text-neutral-600">
          {design.intro_text}
        </p>
      ) : null}

      <div
        className="mt-2 grid grid-cols-4 gap-1 rounded border px-2 py-1.5 text-[9px]"
        style={{ borderColor: `${design.accent_color}55` }}
      >
        <Meta label="Confirmation" value={conf} />
        <Meta label="Check-in" value={fmtIso(data.checkIn)} />
        <Meta label="Check-out" value={fmtIso(data.checkOut)} />
        <Meta
          label="Nights · adults"
          value={`${data.nights || "—"} · ${data.adults || "—"}`}
        />
      </div>

      <div className="mt-2.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <Field label="Guest" value={data.guestName || "—"} />
        {data.agentLabel ? (
          <Field label="Agent" value={data.agentLabel} />
        ) : null}
        {sourceLabel ? <Field label="Booked by" value={sourceLabel} /> : null}
        {paymentLabel ? <Field label="Payment" value={paymentLabel} /> : null}
      </div>

      <div className="mt-2.5 overflow-hidden rounded border border-neutral-300">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr
              className="text-left text-[8px] tracking-[0.14em] text-white uppercase"
              style={{ backgroundColor: design.brand_color }}
            >
              <th className="px-2 py-1.5 font-semibold">Room / item</th>
              <th className="px-2 py-1.5 font-semibold">Code</th>
              <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
              <th className="px-2 py-1.5 text-right font-semibold">Nights</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-2 text-neutral-500">
                  No room lines.
                </td>
              </tr>
            ) : (
              data.lines.map((l) => (
                <tr
                  key={`${l.code}-${l.name}`}
                  className="border-t border-neutral-200"
                >
                  <td className="px-2 py-1.5 font-medium text-neutral-900">
                    {l.name}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[9px] text-neutral-500">
                    {l.code}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {l.qty}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {data.nights}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {notes.length > 0 ? (
        <ul className="mt-2.5 space-y-0.5 text-[9px] text-neutral-600">
          {notes.map((line) => (
            <li key={line} className="flex gap-1.5">
              <span style={{ color: design.accent_color }}>•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {design.terms_text.trim() ? (
        <p className="mt-2 rounded border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-[9px] leading-snug text-neutral-700">
          {design.terms_text}
        </p>
      ) : null}

      <footer className="mt-3 border-t border-neutral-200 pt-2 text-[9px] text-neutral-500">
        {design.footer_text}
      </footer>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] font-semibold tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className="font-medium text-neutral-900">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] font-semibold tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className="text-[11px] font-medium text-neutral-900">{value}</p>
    </div>
  );
}
