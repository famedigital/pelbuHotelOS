import type { TaxInvoiceTotals } from "@/lib/folio/room-tax-invoice";

const PAPER_HEADS = ["Folio", "Description", "Arrv. Date", "Dept. Date", "Nights", "Rate", "Amount"] as const;
const MASTER_HEADS = ["Description", "Check-in", "Check-out", "Nights", "Rate", "Total"] as const;

/** Exact RRCO figure. Up to 4 decimals, no whole-Nu rounding. */
export function formatExactAmount(amount: number): string {
  const n = Math.round((amount + Number.EPSILON) * 10000) / 10000;
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function RoomTaxInvoiceTable({
  bill,
  serviceChargeRate,
  gstRate,
  layout = "paper",
}: {
  bill: TaxInvoiceTotals;
  serviceChargeRate: number;
  gstRate: number;
  /** Master bill is one package line. Room and food papers keep the folio column. */
  layout?: "paper" | "master";
}) {
  const master = layout === "master";
  const heads = master ? MASTER_HEADS : PAPER_HEADS;
  const cell = "border border-[#1a1410] px-1 py-1 align-top";
  const scLabel = `Service Charge(${percent(serviceChargeRate)}%)`;
  const gstLabel = `GST(${percent(gstRate)}%)`;
  const labelSpan = heads.length - 1;
  const figure = (label: string) =>
    label === "Nights" || label === "Rate" || label === "Amount" || label === "Total";
  return (
    <table className="mt-2 w-full border-collapse border border-[#1a1410] text-[12px]">
      <thead>
        <tr className="text-left text-[11px]">
          {heads.map((label) => (
            <th
              key={label}
              className={`${cell} font-semibold ${figure(label) ? "text-right" : ""}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bill.rows.map((row) => (
          <tr key={row.id}>
            {master ? null : (
              <td className={`${cell} whitespace-nowrap`}>{row.folioNo || "—"}</td>
            )}
            <td className={cell}>{row.description}</td>
            <td className={`${cell} whitespace-nowrap tabular-nums`}>{row.arrival || "—"}</td>
            <td className={`${cell} whitespace-nowrap tabular-nums`}>{row.departure || "—"}</td>
            <td className={`${cell} text-right tabular-nums`}>{row.nights}</td>
            <td className={`${cell} text-right tabular-nums`}>{formatExactAmount(row.rate)}</td>
            <td className={`${cell} text-right tabular-nums`}>{formatExactAmount(row.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <Total label="Total" value={bill.total} strong span={labelSpan} />
        <Total label={scLabel} value={bill.serviceCharge} span={labelSpan} />
        <Total label="Discount (0.00%)" value={bill.discount} span={labelSpan} />
        <Total label="Amt. After Discount" value={bill.afterDiscount} span={labelSpan} />
        {gstRate > 0 ? <Total label={gstLabel} value={bill.gst} span={labelSpan} /> : null}
        <Total label="Net Amount Payable" value={bill.net} strong span={labelSpan} />
      </tfoot>
    </table>
  );
}

function Total({
  label,
  value,
  strong,
  span,
}: {
  label: string;
  value: number;
  strong?: boolean;
  span: number;
}) {
  return (
    <tr>
      <td colSpan={span} className="border border-[#1a1410] px-1 py-0.5 text-right text-[12px]">
        {label}
      </td>
      <td
        className={`border border-[#1a1410] px-1 py-0.5 text-right tabular-nums ${strong ? "font-semibold" : ""}`}
      >
        {formatExactAmount(value)}
      </td>
    </tr>
  );
}

function percent(rate: number): string {
  const pct = rate > 0 && rate <= 1 ? rate * 100 : rate;
  return String(Math.round(pct * 100) / 100);
}
