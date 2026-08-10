import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn } from "@/lib/pricing";
import {
  defaultDocumentDesign,
  registrationLines,
  type PropertyDocumentDesign,
} from "@/lib/property-settings";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export type ReceiptProperty = {
  name: string;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  logo_public_id: string | null;
};

export type ReceiptLine = {
  description: string;
  amount: number;
  gst: number;
  serviceCharge: number;
  isPayment: boolean;
};

export type FolioReceiptData = {
  folioId: string;
  label: string;
  bookingId: string | null;
  createdAt: string;
  docNo?: string | null;
  lines: ReceiptLine[];
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-BT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Thimphu",
  });
}

/**
 * Guest folio receipt / checkout card — A4 or thermal.
 * Design from Settings → Documents → Receipt.
 */
export function FolioReceipt({
  data,
  property,
  design: designProp,
}: {
  data: FolioReceiptData;
  property: ReceiptProperty;
  design: PropertyDocumentDesign;
}) {
  const design = designProp ?? defaultDocumentDesign("receipt");
  const brandName = property.name || "Pelbu Suites";
  const legalName = property.legal_name?.trim() || brandName;
  const logoSrc =
    design.show_logo && property.logo_public_id
      ? cloudinaryUrl(property.logo_public_id, { width: 200, crop: "fit" })
      : null;

  const charges = data.lines.filter((line) => !line.isPayment);
  const payments = data.lines.filter((line) => line.isPayment);
  const chargeTotal = charges.reduce((sum, line) => sum + line.amount, 0);
  const gstTotal = charges.reduce((sum, line) => sum + line.gst, 0);
  const serviceTotal = charges.reduce(
    (sum, line) => sum + line.serviceCharge,
    0,
  );
  const paidTotal = payments.reduce(
    (sum, line) => sum + Math.abs(line.amount),
    0,
  );
  const balance = data.lines.reduce((sum, line) => sum + line.amount, 0);
  const notes = registrationLines(design.notes_text);
  const isThermal = design.paper_size === "thermal";

  const style = {
    ["--doc-brand" as string]: design.brand_color,
    ["--doc-accent" as string]: design.accent_color,
    maxWidth: isThermal ? "360px" : "210mm",
  } as CSSProperties;

  return (
    <section
      aria-label="Folio receipt"
      style={style}
      className={cn(
        "doc-print-sheet erp mx-auto border bg-white text-foreground",
        isThermal
          ? "px-3 py-3 text-[10px] leading-snug print:border-0 print:px-0 print:py-0"
          : "px-5 py-4 text-[11px] leading-snug print:max-w-none print:border-0 print:px-6 print:py-4",
        design.preset === "branded" &&
          "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--doc-accent)_10%,white)_0%,white_22%)]",
      )}
    >
      <header
        className={cn(
          "flex items-start justify-between gap-3 border-b-2 pb-2.5",
          isThermal && "flex-col",
        )}
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
            className={cn(
              "mt-0.5 font-semibold tracking-tight",
              isThermal ? "text-base" : "text-lg",
            )}
            style={{ color: design.brand_color }}
          >
            {design.title}
          </h1>
          <p className="mt-0.5 text-[10px] text-neutral-600">
            {design.header_text}
          </p>
          {!isThermal ? (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-neutral-500">
              {design.show_address && property.address ? (
                <span>{property.address}</span>
              ) : null}
              {design.show_phone && property.phone ? (
                <span>T {property.phone}</span>
              ) : null}
              {design.show_email && property.email ? (
                <span>{property.email}</span>
              ) : null}
              {design.show_tax_id && property.tax_id ? (
                <span>Tax {property.tax_id}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              className={
                isThermal
                  ? "h-10 w-auto object-contain"
                  : "h-12 w-auto max-w-[7rem] object-contain"
              }
            />
          ) : null}
          <p
            className="rounded px-1.5 py-0.5 text-[8px] font-semibold tracking-wider text-white uppercase"
            style={{ backgroundColor: design.accent_color }}
          >
            Folio receipt
          </p>
        </div>
      </header>

      {design.intro_text.trim() ? (
        <p className="mt-2 text-[10px] leading-snug text-neutral-600">
          {design.intro_text}
        </p>
      ) : null}

      <div
        className={cn(
          "mt-2 grid gap-1 rounded border px-2 py-1.5 text-[9px]",
          isThermal ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
        )}
        style={{ borderColor: `${design.accent_color}55` }}
      >
        {data.docNo ? <Meta label="Receipt no." value={data.docNo} /> : null}
        <Meta label="Folio" value={data.label} />
        <Meta label="Ref" value={data.folioId.slice(0, 8)} />
        <Meta label="Issued" value={fmtDateTime(data.createdAt)} />
        {data.bookingId ? (
          <Meta label="Booking" value={data.bookingId.slice(0, 8)} />
        ) : null}
      </div>

      <div className="mt-2.5 overflow-hidden rounded border border-neutral-300">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr
              className="text-left text-[8px] tracking-[0.14em] text-white uppercase"
              style={{ backgroundColor: design.brand_color }}
            >
              <th className="px-2 py-1.5 font-semibold">Description</th>
              <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-2 py-2 text-neutral-500">
                  No charges.
                </td>
              </tr>
            ) : (
              charges.map((line, index) => (
                <tr
                  key={`charge-${index}`}
                  className="border-t border-neutral-200"
                >
                  <td className="px-2 py-1.5 text-neutral-900">
                    {line.description}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {formatBtn(line.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        className="mt-2.5 space-y-1 rounded border px-3 py-2.5 text-[10px]"
        style={{ borderColor: design.brand_color }}
      >
        <Money label="Charges" value={chargeTotal} />
        {serviceTotal > 0 ? (
          <Money label="Service charge" value={serviceTotal} />
        ) : null}
        {gstTotal > 0 ? <Money label="GST" value={gstTotal} /> : null}
        {paidTotal > 0 ? <Money label="Paid" value={-paidTotal} /> : null}
        <div className="flex justify-between border-t border-neutral-300 pt-1.5 text-[12px] font-semibold text-neutral-900">
          <span>Balance due</span>
          <span className="tabular-nums">
            {formatBtn(Math.max(balance, 0))}
          </span>
        </div>
      </div>

      {payments.length > 0 ? (
        <div className="mt-2.5">
          <p
            className="text-[8px] font-semibold tracking-[0.16em] uppercase"
            style={{ color: design.brand_color }}
          >
            Payments
          </p>
          <ul className="mt-1 space-y-0.5 text-[10px] text-neutral-600">
            {payments.map((line, index) => (
              <li
                key={`payment-${index}`}
                className="flex justify-between gap-3"
              >
                <span>{line.description}</span>
                <span className="font-mono tabular-nums">
                  {formatBtn(Math.abs(line.amount))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notes.length > 0 && !isThermal ? (
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

      <footer className="mt-3 space-y-0.5 border-t border-neutral-200 pt-2 text-[9px] text-neutral-500">
        {isThermal ? (
          <>
            {design.show_address && property.address ? (
              <p>{property.address}</p>
            ) : null}
            {design.show_phone && property.phone ? <p>{property.phone}</p> : null}
            {design.show_tax_id && property.tax_id ? (
              <p>Tax {property.tax_id}</p>
            ) : null}
          </>
        ) : null}
        <p>{design.footer_text}</p>
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

function Money({ label, value }: { label: string; value: number }) {
  return (
    <p className="flex justify-between text-neutral-600">
      <span>{label}</span>
      <span className="font-mono tabular-nums">{formatBtn(value)}</span>
    </p>
  );
}
