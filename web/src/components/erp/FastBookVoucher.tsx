"use client";

export type FastBookVoucherData = {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  guestPhone?: string;
  agentLabel?: string;
  guideNumber?: string;
  lines: { name: string; code: string; qty: number }[];
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

export function FastBookVoucher({ data }: { data: FastBookVoucherData }) {
  return (
    <section
      id="fast-book-voucher"
      aria-label="Agent voucher"
      className="flex flex-col gap-5 border border-espresso/10 bg-white px-6 py-6 print:border-0 print:px-0 print:py-0"
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-espresso/10 pb-3 print:border-b-2 print:border-espresso">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.28em] text-gold uppercase print:text-espresso">
            Pelbu Suites
          </p>
          <h2 className="mt-1 text-2xl text-espresso print:text-3xl">Agent voucher</h2>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ref</p>
          <p className="font-mono text-sm text-espresso">{data.bookingId}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-espresso print:gap-y-2">
        <Field label="Guest" value={data.guestName || "—"} />
        {data.guestPhone ? <Field label="Phone" value={data.guestPhone} /> : null}
        <Field label="Check-in" value={fmtIso(data.checkIn)} />
        <Field label="Check-out" value={fmtIso(data.checkOut)} />
        <Field label="Nights" value={String(data.nights)} />
        {data.agentLabel ? <Field label="Agent" value={data.agentLabel} /> : null}
        {data.guideNumber ? <Field label="Guide no." value={data.guideNumber} /> : null}
      </dl>

      <div className="overflow-hidden rounded-sm border border-espresso/10 print:border-2 print:border-espresso">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-espresso/[0.04] text-[11px] uppercase tracking-[0.18em] text-muted-foreground print:bg-transparent">
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
                <tr key={`${l.code}-${l.name}`} className="border-t border-espresso/10 print:border-espresso/30">
                  <td className="px-3 py-2 text-espresso">
                    <span className="font-medium">{l.qty} Ã— </span>
                    {l.name}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-espresso">{l.qty}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs italic text-muted-foreground print:text-espresso">
        Present this voucher at check-in. Rates and taxes are settled on the folio.
      </p>

      <div className="mt-1 print:hidden">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-5 text-sm text-espresso transition-colors hover:border-espresso/40 hover:bg-espresso/[0.03]"
        >
          Print voucher
        </button>
      </div>
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
