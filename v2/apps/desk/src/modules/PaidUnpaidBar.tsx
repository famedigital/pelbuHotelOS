import { paidUnpaidPct } from "../lib/finance-reports";
import { formatNu } from "../lib/front-office-store";

/** One stacked bar: green = paid, red = unpaid. */
export function PaidUnpaidBar({
  paid,
  unpaid,
  className = "",
  showLabels = true,
}: {
  paid: number;
  unpaid: number;
  className?: string;
  showLabels?: boolean;
}) {
  const { paidPct, unpaidPct } = paidUnpaidPct(paid, unpaid);
  const empty = paid <= 0 && unpaid <= 0;

  return (
    <div className={className}>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]"
        role="img"
        aria-label={
          empty
            ? "No paid or unpaid amount"
            : `Paid ${paidPct} percent, unpaid ${unpaidPct} percent`
        }
      >
        {empty ? null : (
          <>
            <div
              className="h-full bg-[var(--hos-emerald)]"
              style={{ width: `${paidPct}%` }}
            />
            <div
              className="h-full bg-[var(--hos-ruby)]"
              style={{ width: `${unpaidPct}%` }}
            />
          </>
        )}
      </div>
      {showLabels ? (
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-[10px] tabular-nums">
          <span className="font-semibold text-[var(--hos-emerald)]">
            Paid {formatNu(paid)}
          </span>
          <span className="font-semibold text-[var(--hos-ruby)]">
            Unpaid {formatNu(unpaid)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
