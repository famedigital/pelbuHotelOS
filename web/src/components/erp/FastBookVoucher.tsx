"use client";

import { Button } from "@/components/ui/button";
import { AgentVoucherEmailButton } from "@/components/erp/AgentVoucherEmailButton";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { PropertyDocumentDesign } from "@/lib/property-settings";

export type FastBookVoucherData = {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  guestPhone?: string;
  agentId?: string;
  agentLabel?: string;
  guideNumber?: string;
  lines: { name: string; code: string; qty: number }[];
};

type VoucherProperty = {
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

export function FastBookVoucher({
  data,
  property,
  design,
}: {
  data: FastBookVoucherData;
  property?: VoucherProperty;
  design?: PropertyDocumentDesign;
}) {
  const brandName = property?.name ?? "Pelbu Suites";
  const logoSrc = property?.logo_public_id
    ? cloudinaryUrl(property.logo_public_id, { width: 180, crop: "fit" })
    : null;
  const brandColor = design?.brand_color ?? "#7b1e3a";
  const accentColor = design?.accent_color ?? "#d46f92";
  const headerText = design?.header_text ?? "Present at check-in.";
  const footerText =
    design?.footer_text ?? "Rates and taxes are settled on the folio.";
  const showAddress = design?.show_address ?? true;
  const showPhone = design?.show_phone ?? true;
  const showEmail = design?.show_email ?? true;
  const showTaxId = design?.show_tax_id ?? false;
  return (
    <section
      id="fast-book-voucher"
      aria-label="Agent voucher"
      className="erp flex flex-col gap-5 rounded-lg border bg-card px-6 py-6 print:border-0 print:px-0 print:py-0"
      style={{
        borderColor: accentColor,
        background:
          design?.preset === "branded"
            ? `linear-gradient(180deg, ${accentColor}12, transparent 28%)`
            : undefined,
      }}
    >
      <header className="flex items-baseline justify-between gap-3 border-b pb-3 print:border-b-2 print:border-foreground">
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.2em] uppercase print:text-foreground"
            style={{ color: brandColor }}
          >
            {brandName}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground print:text-3xl">
            Agent voucher
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{headerText}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Ref</p>
          <p className="font-mono text-sm text-foreground">{data.bookingId}</p>
        </div>
      </header>

      {(logoSrc || showAddress || showPhone || showEmail || showTaxId) && (
        <div className="flex flex-wrap items-start justify-between gap-4 text-sm text-muted-foreground">
          <div className="space-y-1">
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

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-foreground print:gap-y-2">
        <Field label="Guest" value={data.guestName || "—"} />
        {data.guestPhone ? <Field label="Phone" value={data.guestPhone} /> : null}
        <Field label="Check-in" value={fmtIso(data.checkIn)} />
        <Field label="Check-out" value={fmtIso(data.checkOut)} />
        <Field label="Nights" value={String(data.nights)} />
        {data.agentLabel ? <Field label="Agent" value={data.agentLabel} /> : null}
        {data.guideNumber ? <Field label="Guide no." value={data.guideNumber} /> : null}
      </dl>

      <div className="overflow-hidden rounded-lg border print:border-2 print:border-foreground">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-[11px] tracking-[0.18em] text-muted-foreground uppercase print:bg-transparent">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Rooms
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {data.lines.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-3 text-muted-foreground">
                  No room lines.
                </td>
              </tr>
            ) : (
              data.lines.map((l) => (
                <tr
                  key={`${l.code}-${l.name}`}
                  className="border-t print:border-foreground/30"
                >
                  <td className="px-3 py-2 text-foreground">
                    <span className="font-medium">{l.qty} × </span>
                    {l.name}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">{l.qty}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs italic text-muted-foreground print:text-foreground">
        {footerText}
      </p>

      <div className="mt-1 flex flex-wrap gap-2 print:hidden">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
        >
          Print voucher
        </Button>
        {data.agentId ? (
          <AgentVoucherEmailButton bookingId={data.bookingId} />
        ) : null}
      </div>
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
