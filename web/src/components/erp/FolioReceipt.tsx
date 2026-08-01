import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn } from "@/lib/pricing";
import type { PropertyDocumentDesign } from "@/lib/property-settings";
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

export function FolioReceipt({
  data,
  property,
  design,
}: {
  data: FolioReceiptData;
  property: ReceiptProperty;
  design: PropertyDocumentDesign;
}) {
  const brandName = property.name || "Pelbu Suites";
  const legalName = property.legal_name || brandName;
  const logoSrc = property.logo_public_id
    ? cloudinaryUrl(property.logo_public_id, { width: 200, crop: "fit" })
    : null;

  const charges = data.lines.filter((line) => !line.isPayment);
  const payments = data.lines.filter((line) => line.isPayment);
  const chargeTotal = charges.reduce((sum, line) => sum + line.amount, 0);
  const gstTotal = charges.reduce((sum, line) => sum + line.gst, 0);
  const serviceTotal = charges.reduce((sum, line) => sum + line.serviceCharge, 0);
  const paidTotal = payments.reduce((sum, line) => sum + Math.abs(line.amount), 0);
  const balance = data.lines.reduce((sum, line) => sum + line.amount, 0);

  const isThermal = design.paper_size === "thermal";

  const wrapStyle: CSSProperties = {
    borderColor: design.accent_color,
    maxWidth: isThermal ? "360px" : "720px",
    background:
      design.preset === "branded"
        ? `linear-gradient(180deg, ${design.accent_color}12, transparent 22%)`
        : undefined,
  };

  return (
    <section
      aria-label="Folio receipt"
      className="erp mx-auto rounded-lg border bg-card px-6 py-6 print:mx-0 print:border-0 print:px-0 print:py-0"
      style={wrapStyle}
    >
      <header
        className="flex flex-wrap items-start justify-between gap-4 border-b pb-4"
        style={{ borderColor: design.brand_color }}
      >
        <div className="space-y-1">
          <p
            className="text-[11px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: design.brand_color }}
          >
            {brandName}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Receipt
          </h1>
          <p className="text-sm text-muted-foreground">{design.header_text}</p>
        </div>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={`${brandName} logo`}
            className="h-16 w-auto object-contain"
          />
        ) : null}
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-foreground sm:grid-cols-3">
        {data.docNo ? <Field label="Receipt no." value={data.docNo} /> : null}
        <Field label="Folio" value={data.label} />
        <Field label="Ref" value={data.folioId.slice(0, 8)} />
        <Field label="Issued" value={fmtDateTime(data.createdAt)} />
        {data.bookingId ? (
          <Field label="Booking" value={data.bookingId.slice(0, 8)} />
        ) : null}
        {legalName !== brandName ? (
          <Field label="Billed by" value={legalName} />
        ) : null}
      </dl>

      <div className="mt-5 overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Description
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-3 text-muted-foreground">
                  No charges.
                </td>
              </tr>
            ) : (
              charges.map((line, index) => (
                <tr key={`charge-${index}`} className="border-t">
                  <td className="px-3 py-2 text-foreground">{line.description}</td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {formatBtn(line.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2 rounded-lg border px-4 py-4 text-sm">
        <Money label="Charges" value={chargeTotal} />
        {serviceTotal > 0 ? (
          <Money label="Service charge" value={serviceTotal} />
        ) : null}
        {gstTotal > 0 ? <Money label="GST" value={gstTotal} /> : null}
        {paidTotal > 0 ? <Money label="Paid" value={-paidTotal} /> : null}
        <div className="flex justify-between border-t pt-2 text-base font-medium text-foreground">
          <span>Balance due</span>
          <span className="tabular-nums">{formatBtn(Math.max(balance, 0))}</span>
        </div>
      </div>

      {payments.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Payments
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {payments.map((line, index) => (
              <li key={`payment-${index}`} className="flex justify-between gap-3">
                <span>{line.description}</span>
                <span className="tabular-nums">
                  {formatBtn(Math.abs(line.amount))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="mt-6 space-y-1 border-t pt-4 text-xs text-muted-foreground">
        {design.show_address && property.address ? (
          <p>{property.address}</p>
        ) : null}
        {design.show_phone && property.phone ? <p>{property.phone}</p> : null}
        {design.show_email && property.email ? <p>{property.email}</p> : null}
        {design.show_tax_id && property.tax_id ? (
          <p>GST/TAX: {property.tax_id}</p>
        ) : null}
        <p className="pt-1">{design.footer_text}</p>
      </footer>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <p className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{formatBtn(value)}</span>
    </p>
  );
}
