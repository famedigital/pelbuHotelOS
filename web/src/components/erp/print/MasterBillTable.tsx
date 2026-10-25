import type { MasterBillRow } from "@/lib/folio/master-bill-rows";
import { formatGuestBtn } from "@/lib/pricing";

const HEADS = ["Folio", "Guest", "Room", "Nights", "Qty", "Rate", "Description", "Amount"] as const;

/** Master bill: one row per folio. Night and item lines stay on the folio pages. */
export function MasterBillTable({ rows }: { rows: MasterBillRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const cell = "border border-[#1a1410] px-1 py-1 align-top";
  return (
    <table className="mt-5 w-full table-fixed border-collapse border border-[#1a1410] text-[11.5px] leading-snug">
      <colgroup>
        <col className="w-[16%]" />
        <col className="w-[14%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
        <col className="w-[7%]" />
        <col className="w-[12%]" />
        <col className="w-[23%]" />
        <col className="w-[12%]" />
      </colgroup>
      <thead>
        <tr className="text-left text-[10px] text-[#1a1410]">
          {HEADS.map((label) => (
            <th
              key={label}
              className={`${cell} font-medium ${label === "Amount" || label === "Rate" || label === "Nights" || label === "Qty" ? "text-right" : ""}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={`${cell} font-medium tabular-nums`}>{row.folio}</td>
            <td className={cell}>{row.guest}</td>
            <td className={`${cell} tabular-nums`}>{row.room}</td>
            <td className={`${cell} text-right tabular-nums`}>{row.nights ?? "—"}</td>
            <td className={`${cell} text-right tabular-nums`}>{row.qty ?? "—"}</td>
            <td className={`${cell} text-right tabular-nums`}>
              {row.rate == null ? "—" : formatGuestBtn(row.rate)}
            </td>
            <td className={cell}>{row.description}</td>
            <td className={`${cell} text-right font-medium tabular-nums`}>
              {formatGuestBtn(row.amount)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className={cell} colSpan={7}>
            Total
          </td>
          <td className={`${cell} text-right font-semibold tabular-nums`}>
            {formatGuestBtn(total)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
