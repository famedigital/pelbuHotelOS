import { orderRef } from "@/lib/order-ref";
import { formatBtn } from "@/lib/pricing";
import type { BankAccount } from "@/lib/property-types";

export type OrderSlipLine = {
  name: string;
  qty: number;
  unitPriceBtn: number;
  notes: string | null;
};

export type OrderSlipData = {
  orderId: string;
  outlet: string;
  createdAt: string;
  customerName: string;
  phone: string;
  deliveryType: string;
  deliveryArea: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  subtotalBtn: number;
  gstBtn: number;
  serviceChargeBtn: number;
  totalBtn: number;
  confirmedAt: string | null;
  confirmedByName: string | null;
  paymentJournalNo: string | null;
  paymentMethod: string | null;
  paymentRecordedAt: string | null;
  lines: OrderSlipLine[];
};

export type OrderSlipProperty = {
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  bankAccounts: BankAccount[];
};

const PAYMENT_LABELS: Record<string, string> = {
  mbob: "mBoB transfer",
  bnb_mpay: "BNB mPay transfer",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  other: "Other",
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

/**
 * The artifact the desk screenshots and sends to the guest on WhatsApp. It has
 * to be readable as a photo of a screen, so: one column, large reference and
 * total, and payment instructions inside the same frame as the items.
 */
export function OnlineOrderSlip({
  order,
  property,
}: {
  order: OrderSlipData;
  property: OrderSlipProperty;
}) {
  const paid = Boolean(order.paymentRecordedAt);
  const delivery =
    order.deliveryType === "taxi"
      ? `Taxi delivery · ${order.deliveryArea ?? "Thimphu"}`
      : "Pickup at Pelbu cafe";

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-sm print:border-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Order confirmation
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {property.name}
          </h2>
          {property.address ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {property.address}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-semibold tracking-tight">
            {orderRef(order.orderId)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stamp(order.createdAt, property.timezone)}
          </p>
        </div>
      </header>

      <div
        className={`px-6 py-4 ${
          paid
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em]">
          {paid ? "Payment received · sent to kitchen" : "Awaiting payment"}
        </p>
        <p className="mt-1 text-sm">
          {paid
            ? `${PAYMENT_LABELS[order.paymentMethod ?? "other"] ?? "Payment"} · journal ${order.paymentJournalNo}`
            : `Please transfer ${formatBtn(order.totalBtn)} and send the journal number back on WhatsApp. Cooking starts once payment is confirmed.`}
        </p>
      </div>

      <dl className="grid gap-4 border-b border-border px-6 py-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Guest
          </dt>
          <dd className="mt-1 font-medium">{order.customerName}</dd>
          <dd className="text-muted-foreground">{order.phone}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Fulfilment
          </dt>
          <dd className="mt-1 font-medium capitalize">{order.outlet}</dd>
          <dd className="text-muted-foreground">{delivery}</dd>
          {order.deliveryAddress ? (
            <dd className="text-muted-foreground">{order.deliveryAddress}</dd>
          ) : null}
        </div>
      </dl>

      <div className="px-6 py-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-center font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {order.lines.map((line, idx) => (
              <tr key={`${line.name}-${idx}`} className="border-t border-border">
                <td className="py-2 pr-3">
                  {line.name}
                  {line.notes ? (
                    <span className="block text-xs text-muted-foreground">
                      {line.notes}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 text-center tabular-nums">{line.qty}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatBtn(line.unitPriceBtn * line.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          <Total label="Subtotal" value={order.subtotalBtn} />
          {order.serviceChargeBtn > 0 ? (
            <Total label="Service charge" value={order.serviceChargeBtn} />
          ) : null}
          {order.gstBtn > 0 ? <Total label="GST" value={order.gstBtn} /> : null}
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt className="text-base font-semibold">Total payable</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {formatBtn(order.totalBtn)}
            </dd>
          </div>
        </dl>

        {order.notes ? (
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Guest note: {order.notes}
          </p>
        ) : null}
      </div>

      {!paid && property.bankAccounts.length > 0 ? (
        <section className="border-t border-border px-6 py-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Pay to
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {property.bankAccounts.map((account) => (
              <li key={`${account.label}-${account.account ?? ""}`}>
                <p className="font-medium">
                  {account.label}
                  {account.bank ? ` · ${account.bank}` : ""}
                </p>
                {account.account ? (
                  <p className="font-mono text-base tracking-wide">
                    {account.account}
                  </p>
                ) : null}
                {account.hint ? (
                  <p className="text-xs text-muted-foreground">{account.hint}</p>
                ) : null}
              </li>
            ))}
          </ul>
          {property.phone ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Send the payment journal number to {property.phone} on WhatsApp.
            </p>
          ) : null}
        </section>
      ) : null}

      <footer className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
        {order.confirmedAt ? (
          <p>
            Confirmed {stamp(order.confirmedAt, property.timezone)}
            {order.confirmedByName ? ` by ${order.confirmedByName}` : ""}
          </p>
        ) : (
          <p>Not yet confirmed by the desk.</p>
        )}
        {paid && order.paymentRecordedAt ? (
          <p>Payment recorded {stamp(order.paymentRecordedAt, property.timezone)}</p>
        ) : null}
      </footer>
    </article>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{formatBtn(value)}</dd>
    </div>
  );
}
