import { formatBtn } from "@/lib/pricing";
import { orderRef } from "@/lib/order-ref";

const TENDER_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
  agent_credit: "Charge agent (invoice later)",
  bank_qr: "Bank QR",
  pay_bt: "Pay.bt",
  deposit: "Deposit",
  room_charge: "Charge to room",
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
};

export type PosPaidReceiptProperty = {
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  gstNumber: string | null;
};

/**
 * Guest-facing PAID receipt after POS settle.
 * Uses `doc-print-sheet` + html[data-doc-paper] (see DocPrintControls / globals)
 * so thermal 80mm stays left-aligned at 72mm — not full-page centered.
 */
export function PosPaidReceipt({
  order,
  property,
}: {
  order: PosPaidReceiptData;
  property: PosPaidReceiptProperty;
}) {
  return (
    <article className="doc-print-sheet mx-auto w-full max-w-[420px] rounded-xl border border-neutral-300 bg-white px-5 py-6 text-neutral-900 shadow-sm print:mx-0 print:border-0 print:px-0 print:py-0 print:shadow-none">
      <header className="border-b border-neutral-300 pb-4 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
          Payment receipt
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {property.name}
        </h1>
        {property.address ? (
          <p className="mt-1 text-xs text-neutral-600">{property.address}</p>
        ) : null}
        {property.phone ? (
          <p className="text-xs text-neutral-600">{property.phone}</p>
        ) : null}
        {property.gstNumber ? (
          <p className="mt-1 text-[11px] text-neutral-500">
            GST / TP No. {property.gstNumber}
          </p>
        ) : null}
      </header>

      <div className="mt-4 flex items-start justify-between gap-3 text-sm">
        <div>
          <p className="font-mono text-lg font-semibold">
            {orderRef(order.orderId)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {stamp(order.settledAt, property.timezone)}
          </p>
          <p className="mt-1 capitalize text-neutral-700">{order.outlet}</p>
        </div>
        <div className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
          Paid
        </div>
      </div>

      <dl className="mt-4 space-y-1 border-b border-dashed border-neutral-300 pb-3 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Guest</dt>
          <dd className="font-medium text-right">{order.customerName}</dd>
        </div>
        {order.phone ? (
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Phone</dt>
            <dd className="text-right">{order.phone}</dd>
          </div>
        ) : null}
        {order.tableName ? (
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Table</dt>
            <dd className="text-right">
              {order.tableName}
              {order.covers ? ` · ${order.covers} covers` : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-[10px] tracking-wide text-neutral-500 uppercase">
            <th className="py-1.5 pr-2 font-medium">Item</th>
            <th className="py-1.5 pr-2 text-right font-medium">Qty</th>
            <th className="py-1.5 text-right font-medium">Amt</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line, i) => (
            <tr key={`${line.name}-${i}`} className="border-b border-neutral-100">
              <td className="py-2 pr-2 align-top">
                <span className="font-medium">{line.name}</span>
                {line.notes ? (
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {line.notes}
                  </span>
                ) : null}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums align-top">
                {line.qty}
              </td>
              <td className="py-2 text-right tabular-nums align-top">
                {formatBtn(line.lineTotalBtn)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-b border-neutral-300 pb-3 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-600">Subtotal</span>
          <span className="tabular-nums">{formatBtn(order.subtotalBtn)}</span>
        </div>
        {order.serviceChargeBtn > 0 ? (
          <div className="flex justify-between">
            <span className="text-neutral-600">Service</span>
            <span className="tabular-nums">
              {formatBtn(order.serviceChargeBtn)}
            </span>
          </div>
        ) : null}
        {order.gstBtn > 0 ? (
          <div className="flex justify-between">
            <span className="text-neutral-600">GST</span>
            <span className="tabular-nums">{formatBtn(order.gstBtn)}</span>
          </div>
        ) : null}
        <div className="flex justify-between pt-1 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatBtn(order.totalBtn)}</span>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-500 uppercase">
          Payment
        </p>
        {order.tenders.map((t, i) => (
          <div key={`${t.method}-${i}`} className="flex justify-between gap-2">
            <span>
              {TENDER_LABELS[t.method] ?? t.method.replace(/_/g, " ")}
              {t.reference ? (
                <span className="ml-1 text-xs text-neutral-500">
                  · {t.reference}
                </span>
              ) : null}
            </span>
            <span className="tabular-nums font-medium">
              {formatBtn(t.amountBtn)}
            </span>
          </div>
        ))}
      </div>

      {order.notes ? (
        <p className="mt-3 text-xs text-neutral-600">Note: {order.notes}</p>
      ) : null}

      {order.folioId ? (
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
          Part or all of this ticket was charged to a guest folio. Tax invoice
          (if required) issues from the folio, not this receipt.
        </p>
      ) : null}

      <footer className="mt-6 border-t border-neutral-200 pt-3 text-center text-[11px] text-neutral-500">
        Thank you · please keep this receipt
      </footer>
    </article>
  );
}
