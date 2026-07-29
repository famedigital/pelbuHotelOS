"use client";

export type FastBookInvoiceData = {
  bookingId: string;
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

export function FastBookInvoice({ data }: { data: FastBookInvoiceData }) {
  const sourceLabel = data.sourceLabel ?? SOURCE_LABELS[data.sourceLabel ?? ""] ?? data.sourceLabel;
  const paymentLabel = data.paymentLabel ?? PAYMENT_LABELS[data.paymentLabel ?? ""] ?? data.paymentLabel;

  return (
    <section
      className="border border-espresso/10 bg-white px-6 py-6 print:hidden"
      aria-label="Desk invoice"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-[0.28em] text-gold uppercase">
          Desk invoice
        </h2>
        <p className="font-mono text-[11px] text-muted-foreground">{data.bookingId}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-espresso sm:grid-cols-4">
        <Field label="Check-in" value={fmtIso(data.checkIn)} />
        <Field label="Check-out" value={fmtIso(data.checkOut)} />
        <Field label="Nights" value={String(data.nights)} />
        <Field label="Adults" value={String(data.adults)} />
        <Field label="Guest" value={data.guestName || "—"} />
        {data.agentLabel ? <Field label="Agent" value={data.agentLabel} /> : null}
        {sourceLabel ? <Field label="Booked by" value={sourceLabel} /> : null}
        {paymentLabel ? <Field label="Payment" value={paymentLabel} /> : null}
      </dl>

      <div className="mt-5 overflow-hidden rounded-sm border border-espresso/10">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-espresso/[0.04] text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
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
                <tr key={`${l.code}-${l.name}`} className="border-t border-espresso/10">
                  <td className="px-3 py-2 text-espresso">{l.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{l.code}</td>
                  <td className="px-3 py-2 text-right font-mono text-espresso">{l.qty}</td>
                  <td className="px-3 py-2 text-right font-mono text-espresso">{data.nights}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 border-t border-espresso/10 pt-3 text-xs italic text-muted-foreground">
        Rates applied on save — see folio.
      </p>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-espresso">{value}</dd>
    </div>
  );
}
