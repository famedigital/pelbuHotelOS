"use client";

import { cloudinaryUrl } from "@/lib/cloudinary";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import type { PropertyDocumentDesign } from "@/lib/property-settings";

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
  lines: { name: string; code: string; qty: number; kind: string }[];
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
  cash: "Cash",
  prepaid: "Prepaid",
  partial: "Partial",
  on_credit: "On credit",
};

export function FastBookInvoice({
  data,
  property,
  design,
  /** Proforma desk note — not a fiscal GST INV# */
  title = "Booking confirmation",
  printId = "print-booking-note",
}: {
  data: FastBookInvoiceData;
  property?: InvoiceProperty;
  design?: PropertyDocumentDesign;
  title?: string;
  printId?: string;
}) {
  const sourceLabel =
    data.sourceLabel != null
      ? (SOURCE_LABELS[data.sourceLabel] ?? data.sourceLabel)
      : undefined;
  const paymentLabel =
    data.paymentLabel != null
      ? (PAYMENT_LABELS[data.paymentLabel] ?? data.paymentLabel)
      : undefined;
  const brandName = property?.name ?? "Pelbu Suites";
  const legalName = property?.legal_name ?? brandName;
  const logoSrc = property?.logo_public_id
    ? cloudinaryUrl(property.logo_public_id, { width: 180, crop: "fit" })
    : null;
  const brandColor = design?.brand_color ?? "#7b1e3a";
  const accentColor = design?.accent_color ?? "#d46f92";
  const headerText = design?.header_text ?? "Direct booking confirmation.";
  const footerText =
    design?.footer_text ??
    "Not a tax invoice — GST INV issues from the guest folio. Rates applied on stay.";
  const showAddress = design?.show_address ?? true;
  const showPhone = design?.show_phone ?? true;
  const showEmail = design?.show_email ?? true;
  const showTaxId = design?.show_tax_id ?? true;

  return (
    <section
      id={printId}
      className="erp doc-print-sheet rounded-lg border bg-card px-6 py-6 print:border-0 print:px-0 print:py-0 print:shadow-none"
      aria-label={title}
      style={{
        borderColor: accentColor,
        background:
          design?.preset === "branded"
            ? `linear-gradient(180deg, ${accentColor}12, transparent 30%)`
            : undefined,
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: brandColor }}
          >
            {brandName}
          </p>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {title}
          </h2>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          Conf{" "}
          <span className="font-semibold text-foreground">
            {bookingConfirmationLabel({
              confirmationCode: data.confirmationCode,
              bookingId: data.bookingId,
            })}
          </span>
        </p>
      </div>

      {(logoSrc || showAddress || showPhone || showEmail || showTaxId) && (
        <div
          className="mt-3 flex flex-wrap items-start justify-between gap-4 border-b pb-4"
          style={{ borderColor: brandColor }}
        >
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{legalName}</p>
            <p>{headerText}</p>
            {showAddress && property?.address ? <p>{property.address}</p> : null}
            {showPhone && property?.phone ? <p>{property.phone}</p> : null}
            {showEmail && property?.email ? <p>{property.email}</p> : null}
            {showTaxId && property?.tax_id ? <p>GST/TAX: {property.tax_id}</p> : null}
          </div>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={`${brandName} logo`}
              className="h-14 w-auto object-contain"
            />
          ) : null}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-foreground sm:grid-cols-4">
        <Field label="Check-in" value={fmtIso(data.checkIn)} />
        <Field label="Check-out" value={fmtIso(data.checkOut)} />
        <Field label="Nights" value={String(data.nights)} />
        <Field label="Adults" value={String(data.adults)} />
        <Field label="Guest" value={data.guestName || "—"} />
        {data.agentLabel ? <Field label="Agent" value={data.agentLabel} /> : null}
        {sourceLabel ? <Field label="Booked by" value={sourceLabel} /> : null}
        {paymentLabel ? <Field label="Payment" value={paymentLabel} /> : null}
      </dl>

      <div className="mt-5 overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Room / bed
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Code
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Qty
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Nights
              </th>
            </tr>
          </thead>
          <tbody>
            {data.lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-muted-foreground">
                  No room lines.
                </td>
              </tr>
            ) : (
              data.lines.map((l) => (
                <tr key={`${l.code}-${l.name}`} className="border-t">
                  <td className="px-3 py-2 text-foreground">{l.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{l.code}</td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">{l.qty}</td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">{data.nights}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 border-t pt-3 text-xs italic text-muted-foreground">
        {footerText}
      </p>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
