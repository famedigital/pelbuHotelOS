import { buildFolioChargeRows, type FolioChargeInput } from "@/lib/folio/folio-charge-rows";
import { formatGuestBtn } from "@/lib/pricing";

const HEADS = ["Particulars", "Room", "Arrival", "Departure", "Nights", "Qty", "Rate", "Amount"] as const;

function money(value: number | null): string {
  return value == null ? "—" : formatGuestBtn(value);
}

/** Room, food, and extras share one list. Facts sit in columns, not in a sentence. */
export function FolioChargeTable({
  lines,
  checkIn,
  checkOut,
}: {
  lines: FolioChargeInput[];
  checkIn?: string | null;
  checkOut?: string | null;
}) {
  const rows = buildFolioChargeRows(lines, { checkIn, checkOut });
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const cell = "border border-[#1a1410] px-1 py-1 align-top";
  return (
    <table className="mt-5 w-full table-fixed border-collapse border border-[#1a1410] text-[11.5px] leading-snug">
      <colgroup>
        <col className="w-[24%]" />
        <col className="w-[8%]" />
        <col className="w-[14%]" />
        <col className="w-[14%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
      </colgroup>
      <thead>
        <tr className="text-left text-[10px] text-[#1a1410]">
          {HEADS.map((label) => (
            <th
              key={label}
              className={`${cell} font-medium ${label === "Particulars" || label === "Room" || label === "Arrival" || label === "Departure" ? "" : "text-right"}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={cell}>{row.particulars}</td>
            <td className={`${cell} tabular-nums`}>{row.room}</td>
            <td className={`${cell} whitespace-nowrap tabular-nums`}>{row.arrival}</td>
            <td className={`${cell} whitespace-nowrap tabular-nums`}>{row.departure}</td>
            <td className={`${cell} text-right tabular-nums`}>{row.nights ?? "—"}</td>
            <td className={`${cell} text-right tabular-nums`}>{row.qty ?? "—"}</td>
            <td className={`${cell} text-right tabular-nums`}>{money(row.rate)}</td>
            <td className={`${cell} text-right font-medium tabular-nums`}>{money(row.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className={cell} colSpan={7}>
            Total
          </td>
          <td className={`${cell} text-right font-semibold tabular-nums`}>{money(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
