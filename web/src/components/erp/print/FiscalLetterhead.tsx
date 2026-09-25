import { cloudinaryUrl } from "@/lib/cloudinary";
import { amountInWordsNu } from "@/lib/print/amount-in-words";
import { formatGuestBtn } from "@/lib/pricing";
import type { ReactNode } from "react";

export type FiscalPropertyChrome = {
  name: string;
  legal_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_id?: string | null;
  logo_public_id?: string | null;
  /** Optional tagline under name (e.g. Hotel · Olakha). */
  tagline?: string | null;
};

export type FiscalLineRow = {
  id: string;
  description: string;
  hint?: string | null;
  qty?: number | null;
  rate?: number | null;
  /** Service charge portion when known. */
  sc?: number | null;
  amount: number;
  foc?: boolean;
};

export type FiscalMetaRow = { label: string; value: string };

/**
 * Pelbu-invoice-* letterhead: logo + name left, kind + title + meta right.
 * Tenant-branded (property fields), not hard-coded Pelbu copy.
 */
export function FiscalLetterhead({
  property,
  kind,
  title,
  meta,
}: {
  property: FiscalPropertyChrome;
  /** e.g. Tax invoice / Proforma / Folio */
  kind: string;
  /** e.g. INVOICE / BILL / PROFORMA / FOLIO */
  title: string;
  meta: FiscalMetaRow[];
}) {
  const hotelName = property.name?.trim() || "Hotel";
  const legal = property.legal_name?.trim();
  const logoSrc = property.logo_public_id
    ? cloudinaryUrl(property.logo_public_id, { width: 160, crop: "fit" })
    : null;
  const tagline =
    property.tagline?.trim() ||
    (legal && legal !== hotelName ? legal : null);

  return (
    <header className="fiscal-lh flex items-start justify-between gap-3 border-b-2 border-[#1a1410] pb-2">
      <div className="flex min-w-0 items-start gap-3">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt=""
            className="h-11 w-11 shrink-0 object-contain"
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-[20px] leading-tight font-bold tracking-wide text-[#1a1410]">
            {hotelName.toUpperCase()}
          </p>
          {tagline ? (
            <p className="mt-0.5 text-[10px] font-bold tracking-[0.16em] text-[#6e2c2c] uppercase">
              {tagline}
            </p>
          ) : null}
          <address className="mt-1 text-[11px] leading-snug not-italic text-[#3a322c]">
            {property.address ? <span className="block">{property.address}</span> : null}
            <span className="block">
              {[
                property.phone ? `T ${property.phone}` : null,
                property.email,
                property.tax_id ? `TPN ${property.tax_id}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </address>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-bold tracking-[0.22em] text-[#6e2c2c] uppercase">
          {kind}
        </p>
        <h2 className="mt-0.5 text-[18px] font-semibold tracking-wide text-[#1a1410]">
          {title}
        </h2>
        <table className="ml-auto mt-1 border-collapse text-[12px]">
          <tbody>
            {meta.map((row) => (
              <tr key={row.label}>
                <td className="pr-3 text-right text-[#5c534c]">{row.label}</td>
                <td className="text-left font-medium text-[#1a1410]">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </header>
  );
}

export function FiscalParties({
  billTo,
  billToDetail,
  from,
  fromDetail,
}: {
  billTo: string;
  billToDetail?: ReactNode;
  from: string;
  fromDetail?: ReactNode;
}) {
  return (
    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      <div className="rounded-sm border border-[#d8d0c6] bg-[#f7f4ef] px-2.5 py-2">
        <p className="text-[9.5px] font-bold tracking-[0.16em] text-[#5c534c] uppercase">
          Bill to
        </p>
        <p className="mt-0.5 text-[13px] font-semibold text-[#1a1410]">{billTo}</p>
        {billToDetail ? (
          <div className="mt-0.5 text-[11px] text-[#3a322c]">{billToDetail}</div>
        ) : null}
      </div>
      <div className="rounded-sm border border-[#d8d0c6] bg-[#f7f4ef] px-2.5 py-2">
        <p className="text-[9.5px] font-bold tracking-[0.16em] text-[#5c534c] uppercase">
          From
        </p>
        <p className="mt-0.5 text-[13px] font-semibold text-[#1a1410]">{from}</p>
        {fromDetail ? (
          <div className="mt-0.5 text-[11px] text-[#3a322c]">{fromDetail}</div>
        ) : null}
      </div>
    </div>
  );
}

export function FiscalStayStrip({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5 grid grid-cols-1 gap-1.5 rounded-sm border border-[#d8d0c6] bg-[#f7f4ef] px-2.5 py-2 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="text-[9.5px] font-bold tracking-[0.14em] text-[#5c534c] uppercase">
            {item.label}
          </p>
          <p className="truncate text-[11.5px] text-[#1a1410]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function FiscalLinesTable({
  rows,
  showSc = false,
}: {
  rows: FiscalLineRow[];
  showSc?: boolean;
}) {
  return (
    <table className="fiscal-invoice-lines mt-2.5 w-full border-collapse text-[12px]">
      <thead>
        <tr className="bg-[#1a1410] text-left text-[10px] tracking-[0.08em] text-white uppercase">
          <th className="px-2 py-1.5 font-medium">#</th>
          <th className="px-2 py-1.5 font-medium">Description</th>
          <th className="px-2 py-1.5 text-right font-medium">Qty</th>
          <th className="px-2 py-1.5 text-right font-medium">Rate</th>
          {showSc ? (
            <th className="px-2 py-1.5 text-right font-medium">SC</th>
          ) : null}
          <th className="px-2 py-1.5 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.id}
            className={`border-b border-[#ddd6cc] ${row.foc ? "text-[#5c534c]" : ""}`}
          >
            <td className="px-2 py-1.5 align-top tabular-nums text-[#5c534c]">
              {i + 1}
            </td>
            <td className="px-2 py-1.5 align-top">
              <span className="font-semibold text-[#1a1410]">
                {row.description}
              </span>
              {row.hint ? (
                <span className="mt-0.5 block text-[10.5px] font-normal text-[#5c534c]">
                  {row.hint}
                </span>
              ) : null}
            </td>
            <td className="px-2 py-1.5 text-right align-top tabular-nums">
              {row.qty != null ? row.qty : "—"}
            </td>
            <td className="px-2 py-1.5 text-right align-top tabular-nums">
              {row.rate != null ? formatGuestBtn(row.rate) : "—"}
            </td>
            {showSc ? (
              <td className="px-2 py-1.5 text-right align-top tabular-nums">
                {row.sc != null && row.sc !== 0
                  ? formatGuestBtn(row.sc)
                  : "—"}
              </td>
            ) : null}
            <td className="px-2 py-1.5 text-right align-top font-medium tabular-nums">
              {formatGuestBtn(row.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FiscalTotalsBlock({
  subtotal,
  serviceCharge,
  gst,
  total,
  serviceChargeRatePct,
}: {
  subtotal: number;
  serviceCharge: number;
  gst: number;
  total: number;
  serviceChargeRatePct?: number | null;
}) {
  const scLabel =
    serviceChargeRatePct != null && serviceChargeRatePct > 0
      ? `Service charge ${serviceChargeRatePct}%`
      : "Service charge";
  return (
    <div className="mt-1">
      <table className="ml-auto w-full max-w-[62%] border-collapse text-[12px]">
        <tbody>
          <tr>
            <td className="px-2 py-1 text-[#5c534c]">Subtotal</td>
            <td className="w-[8.5rem] px-2 py-1 text-right tabular-nums">
              {formatGuestBtn(subtotal)}
            </td>
          </tr>
          <tr>
            <td className="px-2 py-1 text-[#5c534c]">{scLabel}</td>
            <td className="px-2 py-1 text-right tabular-nums">
              {serviceCharge > 0 ? formatGuestBtn(serviceCharge) : "Nil"}
            </td>
          </tr>
          <tr>
            <td className="px-2 py-1 text-[#5c534c]">GST</td>
            <td className="px-2 py-1 text-right tabular-nums">
              {gst > 0 ? formatGuestBtn(gst) : "Nil"}
            </td>
          </tr>
          <tr className="border-t-2 border-[#1a1410] text-[14px] font-bold">
            <td className="px-2 pt-1.5 pb-1">Total payable Nu</td>
            <td className="px-2 pt-1.5 pb-1 text-right tabular-nums">
              {formatGuestBtn(total)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 border-l-[3px] border-[#b8893a] bg-[#f7f4ef] px-2.5 py-1.5 text-[11.5px] text-[#1a1410]">
        Amount in words: <strong>{amountInWordsNu(total)}</strong>
      </p>
    </div>
  );
}

export function FiscalSignOff({ hotelName }: { hotelName: string }) {
  return (
    <div className="mt-3.5 grid grid-cols-2 gap-5 pt-1">
      <div>
        <div className="mb-1 h-7 border-b-[1.5px] border-[#1a1410]" />
        <p className="text-[10px] text-[#5c534c]">Received by</p>
      </div>
      <div>
        <div className="mb-1 h-7 border-b-[1.5px] border-[#1a1410]" />
        <p className="text-[10px] text-[#5c534c]">For {hotelName}</p>
      </div>
    </div>
  );
}

export function FiscalDocFooter({
  property,
  thankYou,
}: {
  property: FiscalPropertyChrome;
  thankYou?: string;
}) {
  const hotelName = property.name?.trim() || "Hotel";
  return (
    <footer className="mt-2.5 border-t border-[#d8d0c6] pt-1.5 text-[10px] leading-snug text-[#5c534c]">
      {property.address ? <p>{property.address}</p> : null}
      <p>{thankYou ?? `Thank you for staying with ${hotelName}.`}</p>
    </footer>
  );
}
