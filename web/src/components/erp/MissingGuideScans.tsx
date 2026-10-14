"use client";

import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import type { MissingGuideScan } from "@/lib/erp/missing-guide-scans";

export function MissingGuideScans({ rows }: { rows: MissingGuideScan[] }) {
  const stayHub = useStayHubOptional();
  if (rows.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-amber-500/40 bg-amber-500/10"
      aria-label="Guide scans not uploaded"
    >
      <div className="px-4 py-3 sm:px-5">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-amber-800 uppercase">
          Guide scan not uploaded
        </p>
        <h2 className="mt-1 text-base font-semibold text-foreground">
          {rows.length} signed settlement{rows.length === 1 ? "" : "s"} still need a scan
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Staff already ticked that the guide signed. Upload the photo or file
          when you have a moment.
        </p>
      </div>
      <ul className="divide-y border-t border-amber-500/30">
        {rows.map((row) => (
          <li key={row.bookingId}>
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-amber-500/10 sm:px-5"
              onClick={() => {
                if (stayHub) {
                  stayHub.openStayHub({
                    bookingId: row.bookingId,
                    step: "check_out",
                    board: row.status === "checked_in" ? "departures" : "auto",
                  });
                  return;
                }
                window.location.href = `/erp/bookings/${row.bookingId}`;
              }}
            >
              <span>
                <span className="font-medium text-foreground">{row.guestName}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {row.roomLabel ? `Room ${row.roomLabel}` : "No room"}
                  {row.agentName ? ` · ${row.agentName}` : ""}
                  {row.checkOut ? ` · out ${row.checkOut}` : ""}
                </span>
              </span>
              <span className="text-xs font-medium text-amber-900">
                Upload scan
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
