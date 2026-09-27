import {
  FiscalLetterhead,
  FiscalLinesTable,
  FiscalParties,
  FiscalSignOff,
  FiscalStayStrip,
  FiscalTotalsBlock,
} from "@/components/erp/print/FiscalLetterhead";
import { orderRef } from "@/lib/order-ref";
import {
  PRINT_DARKEN_DEFAULT,
  printDarkenStyle,
} from "@/lib/pos-print-prefs";
import { normalizePartyName } from "@/lib/pos-training";
import { formatBtn } from "@/lib/pricing";
import type { DocumentPaperSize } from "@/lib/property-settings";
import { POWERED_BY_LINE } from "@/lib/site";

const TENDER_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
  agent_credit: "Charge agent (invoice later)",
  bank_qr: "Bank QR",
  pay_bt: "Pay.bt",
  deposit: "Deposit",
  room_charge: "Charge to room",
  nc: "Non-chargeable",
  comp: "Comp",
};

function stamp(iso: string, timezone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export type PosPaidReceiptLine = {
  name: string;
  qty: number;
  unitPriceBtn: number;
  lineTotalBtn: number;
  notes: string | null;
};

export type PosPaidReceiptTender = {
  method: string;
  amountBtn: number;
  reference: string | null;
};

export type PosPaidReceiptData = {
  orderId: string;
  outlet: string;
  customerName: string;
  phone: string | null;
  tableName: string | null;
  covers: number | null;
  createdAt: string;
  settledAt: string;
  subtotalBtn: number;
  serviceChargeBtn: number;
  gstBtn: number;
  totalBtn: number;
  notes: string | null;
  lines: PosPaidReceiptLine[];
  tenders: PosPaidReceiptTender[];
  folioId: string | null;
  /** Settled order that was later voided — watermark on reprint. */
  voidedAt?: string | null;
};

export type PosPaidReceiptProperty = {
  name: string;
  legalName?: string | null;
  address: string | null;
  phone: string | null;
  email?: string | null;
  timezone: string;
  gstNumber: string | null;
  logoPublicId?: string | null;
};

/**
 * Guest-facing PAID receipt after POS settle.
 * A4 follows the fiscal letterhead (logo, bill-to, ink table).
 * Thermal stays a short till slip.
 */
export function PosPaidReceipt({
  order,
  property,
  paper = "thermal",
  darken = PRINT_DARKEN_DEFAULT,
}: {
  order: PosPaidReceiptData;
  property: PosPaidReceiptProperty;
  paper?: DocumentPaperSize;
  /** Thermal darkness 0–15. Ignored on A4. */
  darken?: number;
}) {
  const party = normalizePartyName(order.customerName);
  const voided = Boolean(order.voidedAt);

  if (paper === "a4") {
    const stay = [
      { label: "Outlet", value: order.outlet },
      order.tableName
        ? {
            label: "Table",
            value: order.covers
              ? `${order.tableName} · ${order.covers} covers`
              : order.tableName,
          }
        : null,
      {
        label: "Status",
        value: voided ? "Void" : "Paid",
      },
    ].filter((item): item is { label: string; value: string } => Boolean(item));

    return (
      <article className={`doc-print-sheet fiscal-invoice-sheet relative mx-auto w-full max-w-[210mm] border border-[#d8d0c6] bg-white px-[12mm] py-[8mm] text-[12.5px] leading-snug text-[#1a1410] print:border-0 print:px-0 print:py-0 ${order.lines.length >= 8 ? "fiscal-invoice-compact" : ""} ${order.lines.length >= 16 ? "fiscal-invoice-tight" : ""}`}>
        {voided ? (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 rotate-[-18deg] text-center text-5xl font-black tracking-[0.3em] text-[#6e2c2c]/20 uppercase">
            VOID
          </p>
        ) : null}
        <FiscalLetterhead
          property={{
            name: property.name,
            legal_name: property.legalName,
            address: property.address,
            phone: property.phone,
            email: property.email,
            tax_id: property.gstNumber,
            logo_public_id: property.logoPublicId,
          }}
          kind={voided ? "Void receipt" : "Payment receipt"}
          title={voided ? "VOID" : "RECEIPT"}
          meta={[
            { label: "Date", value: stamp(order.settledAt, property.timezone) },
            { label: "Receipt no.", value: orderRef(order.orderId) },
            { label: "Currency", value: "BTN (Ngultrum)" },
          ]}
        />
        <FiscalParties
          billTo={party}
          billToDetail={
            order.phone && order.phone !== "walk-in" ? (
              <p>{order.phone}</p>
            ) : null
          }
          from={property.name}
          fromDetail={
            <>
              {property.address ? <p>{property.address}</p> : null}
              {property.phone ? <p>{property.phone}</p> : null}
              {property.gstNumber ? <p>TPN {property.gstNumber}</p> : null}
            </>
          }
        />
        <FiscalStayStrip items={stay} />
        <FiscalLinesTable
          dense={order.lines.length >= 8}
          rows={order.lines.map((line, i) => ({
            id: `${line.name}-${i}`,
            description: line.name,
            hint: line.notes,
            qty: line.qty,
            rate: line.unitPriceBtn,
            amount: line.lineTotalBtn,
          }))}
        />
        <FiscalTotalsBlock
          subtotal={order.subtotalBtn}
          serviceCharge={order.serviceChargeBtn}
          gst={order.gstBtn}
          total={order.totalBtn}
        />
        <div className="mt-3 text-[12px] text-[#3a322c]">
          <p className="text-[10px] font-bold tracking-[0.16em] text-[#5c534c] uppercase">
            Payment
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {order.tenders.map((t, i) => (
              <li key={`${t.method}-${i}`}>
                {TENDER_LABELS[t.method] ?? t.method.replace(/_/g, " ")}
                {t.reference ? ` · ${t.reference}` : ""} — {formatBtn(t.amountBtn)}
              </li>
            ))}
          </ul>
          {order.notes ? <p className="mt-2">Note: {order.notes}</p> : null}
          {order.folioId ? (
            <p className="mt-2">
              Charged to a guest folio. A tax invoice, if required, comes from
              the folio.
            </p>
          ) : null}
        </div>
        <FiscalSignOff hotelName={property.name} />
        <footer className="mt-3 border-t border-[#d8d0c6] pt-2 text-[10.5px] leading-snug text-[#5c534c]">
          {property.address ? <p>{property.address}</p> : null}
          <p>Thank you · please keep this receipt</p>
          <p className="mt-1 font-medium tracking-wide text-[#1a1410]">
            {POWERED_BY_LINE}
          </p>
        </footer>
      </article>
    );
  }

  return (
    <article
      className="pos-receipt pos-slip-darken doc-print-sheet relative mx-auto w-full max-w-[320px] rounded-xl border-2 border-black bg-white px-3 py-3 text-[13px] leading-tight font-bold text-black shadow-sm print:mx-0 print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
      style={printDarkenStyle(Math.max(darken, 12))}
    >
      {voided ? (
        <p className="pos-slip-void pointer-events-none absolute inset-x-0 top-1/3 rotate-[-18deg] text-center text-3xl font-black tracking-[0.25em] uppercase">
          VOID
        </p>
      ) : null}
      <header className="border-b-2 border-black pb-1.5 text-center">
        <p className="text-[10px] font-black tracking-[0.18em] uppercase">
          Payment receipt
        </p>
        <h1 className="mt-0.5 text-base font-black leading-tight tracking-tight">
          {property.name}
        </h1>
        {property.address ? (
          <p className="mt-0.5 text-[11px] font-bold leading-snug">
            {property.address}
          </p>
        ) : null}
        {property.phone ? (
          <p className="text-[11px] font-bold">{property.phone}</p>
        ) : null}
        {property.gstNumber ? (
          <p className="text-[10px] font-bold">
            GST / TP No. {property.gstNumber}
          </p>
        ) : null}
      </header>

      <div className="mt-1.5 border-b border-black pb-1.5 text-center">
        <p className="text-[10px] font-black tracking-[0.14em] uppercase">
          Party / bill to
        </p>
        <p className="text-sm font-black leading-tight">{party}</p>
        {order.tableName ? (
          <p className="text-xs font-black">
            Table {order.tableName}
            {order.covers ? ` · ${order.covers} covers` : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-1.5 flex items-start justify-between gap-2 border-b border-black pb-1.5">
        <div className="min-w-0">
          <p className="font-mono text-sm font-black">
            {orderRef(order.orderId)}
          </p>
          <p className="text-[11px] font-bold">
            {stamp(order.settledAt, property.timezone)}
          </p>
          <p className="text-[11px] font-bold capitalize">{order.outlet}</p>
          {order.phone ? (
            <p className="text-[11px] font-bold">{order.phone}</p>
          ) : null}
        </div>
        <p className="shrink-0 border-2 border-black px-1.5 py-0.5 text-[10px] font-black tracking-wide uppercase">
          {voided ? "Void" : "Paid"}
        </p>
      </div>

      <table className="mt-1.5 w-full text-xs">
        <thead>
          <tr className="border-b-2 border-black text-left text-[10px] font-black tracking-wide uppercase">
            <th className="py-0.5 pr-1 font-black">Item</th>
            <th className="py-0.5 pr-1 text-right font-black">Qty</th>
            <th className="py-0.5 text-right font-black">Amt</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line, i) => (
            <tr key={`${line.name}-${i}`} className="border-b border-black">
              <td className="py-0.5 pr-1 align-top">
                <span className="font-black">{line.name}</span>
                {line.notes ? (
                  <span className="block text-[10px] font-bold">
                    {line.notes}
                  </span>
                ) : null}
              </td>
              <td className="py-0.5 pr-1 text-right font-black tabular-nums align-top">
                {line.qty}
              </td>
              <td className="py-0.5 text-right font-black tabular-nums align-top">
                {formatBtn(line.lineTotalBtn)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-1.5 space-y-0.5 border-b-2 border-black pb-1.5 text-xs font-bold">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatBtn(order.subtotalBtn)}</span>
        </div>
        {order.serviceChargeBtn > 0 ? (
          <div className="flex justify-between">
            <span>Service</span>
            <span className="tabular-nums">
              {formatBtn(order.serviceChargeBtn)}
            </span>
          </div>
        ) : null}
        {order.gstBtn > 0 ? (
          <div className="flex justify-between">
            <span>GST</span>
            <span className="tabular-nums">{formatBtn(order.gstBtn)}</span>
          </div>
        ) : null}
        <div className="flex justify-between pt-0.5 text-sm font-black">
          <span>Total</span>
          <span className="tabular-nums">{formatBtn(order.totalBtn)}</span>
        </div>
      </div>

      <div className="mt-1.5 space-y-0.5 text-xs font-bold">
        <p className="text-[10px] font-black tracking-[0.14em] uppercase">
          Payment
        </p>
        {order.tenders.map((t, i) => (
          <div key={`${t.method}-${i}`} className="flex justify-between gap-2">
            <span>
              {TENDER_LABELS[t.method] ?? t.method.replace(/_/g, " ")}
              {t.reference ? (
                <span className="font-bold"> · {t.reference}</span>
              ) : null}
            </span>
            <span className="font-black tabular-nums">
              {formatBtn(t.amountBtn)}
            </span>
          </div>
        ))}
      </div>

      {order.notes ? (
        <p className="mt-1.5 text-[11px] font-bold">Note: {order.notes}</p>
      ) : null}

      {order.folioId ? (
        <p className="mt-1.5 text-[10px] font-bold leading-snug">
          Charged to a guest folio. Tax invoice, if required, comes from the
          folio.
        </p>
      ) : null}

      <footer className="mt-2 border-t-2 border-black pt-1 text-center text-[10px] font-black">
        <p>Thank you · please keep this receipt</p>
        <p className="mt-0.5">{POWERED_BY_LINE}</p>
      </footer>
    </article>
  );
}
