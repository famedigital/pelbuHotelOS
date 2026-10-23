import { cloudinaryUrl } from "@/lib/cloudinary";
import { amountInWordsNu } from "@/lib/print/amount-in-words";
import { formatGuestBtn, roundBtn } from "@/lib/pricing";
import type { ReactNode } from "react";

export type FiscalPropertyChrome = {
  name: string;
  legal_name?: string | null;
  address?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
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
  gst?: number | null;
  amount: number;
  foc?: boolean;
};

export type FiscalMetaRow = { label: string; value: ReactNode };

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
    ? cloudinaryUrl(property.logo_public_id, {
        width: 160,
        height: 160,
        crop: "fit",
        format: "png",
        quality: "auto:best",
        dpr: 1,
      })
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
            className="h-[52px] w-[52px] shrink-0 object-contain"
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
                property.whatsapp &&
                !`${property.phone ?? ""}`.includes(property.whatsapp)
                  ? `WhatsApp ${property.whatsapp}`
                  : null,
                property.email,
                property.website &&
                !`${property.address ?? ""}`.includes(property.website)
                  ? property.website
                  : null,
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
  items: { label: string; value: ReactNode }[];
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

/** Line total is rate × qty. Service charge stays in the footer. */
export function fiscalLineExtended(row: FiscalLineRow): number {
  if (
    row.qty != null &&
    row.rate != null &&
    Number.isFinite(row.qty) &&
    Number.isFinite(row.rate)
  ) {
    return roundBtn(row.qty * row.rate);
  }
  return row.amount;
}

export function FiscalLinesTable({
  rows,
  showSc = false,
  showGst = false,
  dense = false,
  layout = "default",
}: {
  rows: FiscalLineRow[];
  showSc?: boolean;
  showGst?: boolean;
  /** Tighter rows when the bill has many lines. */
  dense?: boolean;
  /** Food bill: Items, Rate, Qty, Total. Service charge is not a column. */
  layout?: "default" | "items";
}) {
  const cell = dense ? "px-1.5 py-0.5" : "px-2 py-1";
  const food = layout === "items";
  return (
    <table className="fiscal-invoice-lines mt-2 w-full border-collapse text-[12px]">
      <thead>
        <tr className="bg-[#1a1410] text-left text-[10px] tracking-[0.08em] text-white uppercase">
          {food ? null : <th className={`${cell} font-medium`}>#</th>}
          <th className={`${cell} font-medium`}>{food ? "Items" : "Description"}</th>
          {food ? (
            <th className={`${cell} text-right font-medium`}>Rate</th>
          ) : null}
          <th className={`${cell} text-right font-medium`}>Qty</th>
          {food ? null : (
            <th className={`${cell} text-right font-medium`}>Rate</th>
          )}
          {showSc && !food ? (
            <th className={`${cell} text-right font-medium`}>SC</th>
          ) : null}
          {showGst && !food ? (
            <th className={`${cell} text-right font-medium`}>GST</th>
          ) : null}
          <th className={`${cell} text-right font-medium`}>
            {food ? "Total" : "Amount"}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.id}
            className={`border-b border-[#ddd6cc] ${row.foc ? "text-[#5c534c]" : ""}`}
          >
            {food ? null : (
              <td className={`${cell} align-top tabular-nums text-[#5c534c]`}>
                {i + 1}
              </td>
            )}
            <td className={`${cell} align-top leading-tight`}>
              <span className="font-semibold text-[#1a1410]">
                {row.description}
              </span>
              {row.hint ? (
                <span className="mt-0.5 block text-[10px] font-normal text-[#5c534c]">
                  {row.hint}
                </span>
              ) : null}
            </td>
            {food ? (
              <td className={`${cell} text-right align-top tabular-nums`}>
                {row.rate != null ? formatGuestBtn(row.rate) : "—"}
              </td>
            ) : null}
            <td className={`${cell} text-right align-top tabular-nums`}>
              {row.qty != null ? row.qty : "—"}
            </td>
            {food ? null : (
              <td className={`${cell} text-right align-top tabular-nums`}>
                {row.rate != null ? formatGuestBtn(row.rate) : "—"}
              </td>
            )}
            {showSc && !food ? (
              <td className={`${cell} text-right align-top tabular-nums`}>
                {row.sc != null && row.sc !== 0
                  ? formatGuestBtn(row.sc)
                  : "—"}
              </td>
            ) : null}
            {showGst && !food ? (
              <td className={`${cell} text-right align-top tabular-nums`}>
                {row.gst != null && row.gst !== 0
                  ? formatGuestBtn(row.gst)
                  : "—"}
              </td>
            ) : null}
            <td className={`${cell} text-right align-top font-medium tabular-nums`}>
              {formatGuestBtn(food ? fiscalLineExtended(row) : row.amount)}
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
  summary = "full",
}: {
  subtotal: number;
  serviceCharge: number;
  gst: number;
  total: number;
  serviceChargeRatePct?: number | null;
  /** Food bill: S.C. then the payable total. No subtotal row. */
  summary?: "full" | "food";
}) {
  const scPct =
    serviceChargeRatePct != null && serviceChargeRatePct > 0
      ? ` ${serviceChargeRatePct}%`
      : "";
  const scLabel = summary === "food" ? `S.C.${scPct}` : `Service charge${scPct}`;
  return (
    <div className="mt-1">
      <table className="ml-auto w-full max-w-[62%] border-collapse text-[12px]">
        <tbody>
          {summary === "food" ? null : (
            <tr>
              <td className="px-2 py-1 text-[#5c534c]">Subtotal</td>
              <td className="w-[8.5rem] px-2 py-1 text-right tabular-nums">
                {formatGuestBtn(subtotal)}
              </td>
            </tr>
          )}
          <tr>
            <td className="px-2 py-1 text-[#5c534c]">{scLabel}</td>
            <td className="w-[8.5rem] px-2 py-1 text-right tabular-nums">
              {serviceCharge !== 0 ? formatGuestBtn(serviceCharge) : "Nil"}
            </td>
          </tr>
          {summary === "food" && !(gst > 0) ? null : (
            <tr>
              <td className="px-2 py-1 text-[#5c534c]">GST</td>
              <td className="px-2 py-1 text-right tabular-nums">
                {gst > 0 ? formatGuestBtn(gst) : "GST not charged"}
              </td>
            </tr>
          )}
          <tr className="border-t-2 border-[#1a1410] text-[14px] font-bold">
            <td className="px-2 pt-1.5 pb-1">
              {summary === "food" ? "Total" : "Total payable Nu"}
            </td>
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

export type FiscalFoodTicket = {
  id: string;
  when: string;
  place: string;
  enteredBy: string;
  acknowledged: string;
  payment: string;
};

/** One row per POS ticket on the food bill: when, where, who, ack, how paid. */
export function FiscalFoodTickets({ tickets }: { tickets: FiscalFoodTicket[] }) {
  if (tickets.length === 0) return null;
  return (
    <table className="mt-2 w-full border-collapse text-[11px]">
      <thead>
        <tr className="bg-[#1a1410] text-left text-[9px] tracking-[0.08em] text-white uppercase">
          <th className="px-1.5 py-1 font-medium">Time</th>
          <th className="px-1.5 py-1 font-medium">Place</th>
          <th className="px-1.5 py-1 font-medium">Entered by</th>
          <th className="px-1.5 py-1 font-medium">Acknowledged</th>
          <th className="px-1.5 py-1 font-medium">Payment</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((ticket) => (
          <tr key={ticket.id} className="border-b border-[#ddd6cc]">
            <td className="px-1.5 py-1 align-top whitespace-nowrap">{ticket.when}</td>
            <td className="px-1.5 py-1 align-top">{ticket.place}</td>
            <td className="px-1.5 py-1 align-top">{ticket.enteredBy}</td>
            <td className="px-1.5 py-1 align-top">{ticket.acknowledged}</td>
            <td className="px-1.5 py-1 align-top">{ticket.payment}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FiscalSignOff({
  hotelName,
  leftLabel = "Received by",
}: {
  hotelName: string;
  leftLabel?: string;
}) {
  return (
    <div className="fiscal-signoff mt-3 grid grid-cols-2 gap-5 pt-1">
      <div>
        <div className="mb-1 h-7 border-b-[1.5px] border-[#1a1410]" />
        <p className="text-[10px] text-[#5c534c]">{leftLabel}</p>
      </div>
      <div>
        <div className="mb-1 h-7 border-b-[1.5px] border-[#1a1410]" />
        <p className="text-[10px] text-[#5c534c]">For {hotelName}</p>
      </div>
    </div>
  );
}

export function FiscalPayBlock({
  banks,
  qrDataUrl,
  prominent = false,
}: {
  banks: {
    label: string;
    bank?: string;
    account?: string;
    hint?: string;
    qr_url?: string;
  }[];
  qrDataUrl?: string | null;
  /** Larger account number and QR, for the bill the guide pays from. */
  prominent?: boolean;
}) {
  if (banks.length === 0 && !qrDataUrl) return null;
  const qr = prominent ? 132 : 96;
  return (
    <div className="mt-4 grid grid-cols-[1fr_auto] items-start gap-4 border-t border-[#1a1410] pt-3 text-[#1a1410]">
      <div>
        <p className="text-[11px] font-semibold">Pay to this account</p>
        {banks.length === 0 ? (
          <p className="mt-1 text-[12px] text-[#5c534c]">Ask the desk for the account.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {banks.map((bank) => (
              <li key={`${bank.label}-${bank.account ?? ""}`}>
                <p className="text-[12px] font-semibold">{bank.bank || bank.label}</p>
                {bank.label && bank.bank ? (
                  <p className="text-[12px]">{bank.label}</p>
                ) : null}
                {bank.account ? (
                  <p className="mt-0.5">
                    <span className="text-[11px] text-[#5c534c]">Account no. </span>
                    <span
                      className={
                        prominent
                          ? "font-mono text-[16px] font-semibold tracking-wide tabular-nums"
                          : "font-mono text-[13px] font-semibold tabular-nums"
                      }
                    >
                      {bank.account}
                    </span>
                  </p>
                ) : null}
                {bank.hint ? <p className="text-[11px] text-[#5c534c]">{bank.hint}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {qrDataUrl ? (
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Pay QR" width={qr} height={qr} />
          <p className="mt-1 text-[11px]">Scan to pay</p>
        </div>
      ) : null}
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
