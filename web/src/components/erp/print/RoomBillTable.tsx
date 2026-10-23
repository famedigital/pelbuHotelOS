import { formatGuestBtn } from "@/lib/pricing";
import { roomBillTotal, type RoomBillRow } from "@/lib/folio/room-bill";

const HEADS = [
  "#",
  "Description",
  "Check-in",
  "Check-out",
  "Rooms",
  "Nights",
  "Rate",
  "Amount",
] as const;

function money(value: number | null): string {
  return value == null ? "—" : formatGuestBtn(value);
}

/** Room bill: one row per room category, stay facts in the description. */
export function RoomBillTable({
  rows,
  tone = "desk",
}: {
  rows: RoomBillRow[];
  tone?: "desk" | "paper";
}) {
  const paper = tone === "paper";
  const total = roomBillTotal(rows);
  const head = paper
    ? "border-b border-[#1a1410] text-left text-[10px] text-[#1a1410]"
    : "text-left text-[11px] uppercase tracking-wide text-muted-foreground";
  const cell = paper ? "px-1 py-1.5 align-top" : "px-2 py-1.5 align-top";
  const line = paper ? "border-b border-[#e4ddd4]" : "border-t";

  return (
    <div className={paper ? "mt-5" : "overflow-x-auto"}>
      <table
        className={
          paper
            ? "w-full table-fixed border-collapse text-[11.5px] leading-snug"
            : "w-full min-w-[44rem] text-left text-sm"
        }
      >
        {paper ? (
          <colgroup>
            <col className="w-[6%]" />
            <col className="w-[28%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
          </colgroup>
        ) : null}
        <thead className={head}>
          <tr>
            {HEADS.map((label) => (
              <th
                key={label}
                className={`${cell} font-medium ${
                  label === "Amount" || label === "Rate" ? "text-right" : ""
                } ${label === "Rooms" || label === "Nights" ? "text-right" : ""}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.description}-${index}`} className={line}>
              <td
                className={`${cell} tabular-nums ${paper ? "text-[#5c534c]" : "text-muted-foreground"}`}
              >
                {index + 1}
              </td>
              <td className={`${cell} leading-snug ${paper ? "w-[34%]" : "max-w-[16rem]"}`}>
                {row.description}
              </td>
              <td className={`${cell} whitespace-nowrap tabular-nums`}>
                {row.checkInLabel}
              </td>
              <td className={`${cell} whitespace-nowrap tabular-nums`}>
                {row.checkOutLabel}
              </td>
              <td className={`${cell} text-right tabular-nums`}>{row.rooms}</td>
              <td className={`${cell} text-right tabular-nums`}>{row.nights}</td>
              <td className={`${cell} text-right tabular-nums`}>
                {money(row.rate)}
              </td>
              <td className={`${cell} text-right font-medium tabular-nums`}>
                {money(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={paper ? "border-t border-[#1a1410]" : "border-t font-medium"}>
            <td className={cell} colSpan={7}>
              Grand total
            </td>
            <td className={`${cell} text-right font-semibold tabular-nums`}>
              {money(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
