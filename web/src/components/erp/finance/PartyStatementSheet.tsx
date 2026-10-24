import type { PartyStatement } from "@/lib/finance/party-statement";
import { formatBtn } from "@/lib/pricing";

export function PartyStatementSheet({
  hotel,
  statement,
}: {
  hotel: string;
  statement: PartyStatement;
}) {
  return (
    <article className="mx-auto max-w-[190mm] bg-white text-sm text-black">
      <h1 className="text-lg font-semibold">{hotel}</h1>
      <p className="mt-1">
        {statement.title} · {statement.period}
      </p>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1">Date</th>
            <th className="py-1">Details</th>
            <th className="py-1 text-right">Debit</th>
            <th className="py-1 text-right">Credit</th>
            <th className="py-1 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-1" colSpan={4}>
              Balance brought forward
            </td>
            <td className="py-1 text-right tabular-nums">{formatBtn(statement.broughtForward)}</td>
          </tr>
          {statement.lines.map((line, index) => (
            <tr key={`${line.date}-${index}`} className="border-b">
              <td className="py-1">{line.date}</td>
              <td className="py-1">{line.details}</td>
              <td className="py-1 text-right tabular-nums">
                {line.debit != null ? formatBtn(line.debit) : ""}
              </td>
              <td className="py-1 text-right tabular-nums">
                {line.credit != null ? formatBtn(line.credit) : ""}
              </td>
              <td className="py-1 text-right tabular-nums">{formatBtn(line.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4">
        Amount still due {formatBtn(statement.due)}. {statement.dueWords}.
      </p>
    </article>
  );
}
