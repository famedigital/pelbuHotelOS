import { orderRef } from "@/lib/order-ref";
import { prepStationLabel, sortPrepStations } from "@/lib/kot";

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

export type PosKotLine = {
  name: string;
  qty: number;
  notes: string | null;
  prepStation: string | null;
  courseNo: number | null;
  seatNo: number | null;
};

export type PosKotSlipData = {
  orderId: string;
  outlet: string;
  customerName: string;
  tableName: string | null;
  covers: number | null;
  courseCount: number | null;
  createdAt: string;
  notes: string | null;
  lines: PosKotLine[];
};

/**
 * Kitchen Order Ticket — thermal-first, high-contrast, station groups.
 */
export function PosKotSlip({
  order,
  propertyName,
  timezone,
}: {
  order: PosKotSlipData;
  propertyName: string;
  timezone: string;
}) {
  const stations = sortPrepStations([
    ...new Set(
      order.lines.map((l) => (l.prepStation ?? "kitchen").trim() || "kitchen"),
    ),
  ]);

  return (
    <article className="doc-print-sheet mx-auto w-full max-w-[320px] rounded-xl border border-neutral-800 bg-white px-3 py-4 text-neutral-900 shadow-sm print:mx-0 print:max-w-none print:border-0 print:px-0 print:py-0 print:shadow-none">
      <header className="border-b-2 border-neutral-900 pb-2 text-center">
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase">
          Kitchen · KOT
        </p>
        <h1 className="mt-0.5 text-lg font-bold tracking-tight">
          {propertyName}
        </h1>
        <p className="mt-0.5 text-xs capitalize text-neutral-600">
          {order.outlet}
        </p>
      </header>

      <div className="mt-3 space-y-0.5 border-b border-dashed border-neutral-400 pb-2 text-sm">
        <p className="font-mono text-base font-bold">
          {orderRef(order.orderId)}
        </p>
        <p className="text-xs text-neutral-600">
          {stamp(order.createdAt, timezone)}
        </p>
        {order.tableName ? (
          <p className="text-base font-bold">
            Table {order.tableName}
            {order.covers ? ` · ${order.covers} pax` : ""}
          </p>
        ) : (
          <p className="font-semibold">{order.customerName || "Walk-in"}</p>
        )}
        {order.courseCount && order.courseCount > 1 ? (
          <p className="text-xs font-medium">
            Course run · {order.courseCount} courses
          </p>
        ) : null}
      </div>

      {stations.map((station) => {
        const lines = order.lines.filter(
          (l) =>
            ((l.prepStation ?? "kitchen").trim() || "kitchen") === station,
        );
        if (lines.length === 0) return null;
        return (
          <section key={station} className="mt-3">
            <p className="border-b border-neutral-900 pb-0.5 text-[11px] font-bold tracking-[0.16em] uppercase">
              {prepStationLabel(station)}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {lines.map((line, i) => (
                <li
                  key={`${station}-${line.name}-${i}`}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="w-7 shrink-0 text-right font-mono text-base font-bold tabular-nums">
                    {line.qty}×
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold leading-snug">
                      {line.name}
                    </span>
                    {line.courseNo && line.courseNo > 1 ? (
                      <span className="ml-1 text-[10px] font-medium text-neutral-500">
                        C{line.courseNo}
                      </span>
                    ) : null}
                    {line.seatNo ? (
                      <span className="ml-1 text-[10px] text-neutral-500">
                        Seat {line.seatNo}
                      </span>
                    ) : null}
                    {line.notes ? (
                      <span className="mt-0.5 block text-xs font-medium text-neutral-700">
                        ※ {line.notes}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {order.notes ? (
        <p className="mt-3 border-t border-dashed border-neutral-400 pt-2 text-xs font-medium">
          Ticket: {order.notes}
        </p>
      ) : null}

      <footer className="mt-4 border-t-2 border-neutral-900 pt-2 text-center text-[10px] font-semibold tracking-wide uppercase">
        — end KOT —
      </footer>
    </article>
  );
}
