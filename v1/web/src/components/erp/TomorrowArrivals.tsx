"use client";

import { saveBookingGuideNumber } from "@/app/actions/erp-guide-number";
import type { TomorrowArrival } from "@/lib/erp/tomorrow-arrivals";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function TomorrowArrivals({ rows }: { rows: TomorrowArrival[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border bg-card px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">Tomorrow</h2>
        <p className="mt-1 text-xs text-muted-foreground">No arrivals tomorrow.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="Tomorrow arrivals">
      <div className="flex items-baseline justify-between gap-2 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">Tomorrow</h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {rows.length} arrival{rows.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="divide-y border-t">
        {rows.map((row) => (
          <TomorrowRow key={row.bookingId} row={row} />
        ))}
      </ul>
    </section>
  );
}

function TomorrowRow({ row }: { row: TomorrowArrival }) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agentContact = [row.agentPhone, row.agentEmail].filter(Boolean).join(" · ");

  return (
    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_auto] sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{row.guestName}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-semibold",
              row.roomLabel
                ? "bg-sky-500/15 text-sky-900 dark:text-sky-100"
                : "bg-rose-700/15 text-rose-900 dark:text-rose-100",
            )}
          >
            {row.roomLabel ?? "No room"}
          </span>
          <span>{row.agentName ?? "No agent"}</span>
          <span>{(row.mealPlanCode ?? "EP").toUpperCase()}</span>
        </p>
        {row.guideMissing ? (
          <p className="mt-1 text-xs font-medium text-amber-900 dark:text-amber-100">
            Guide number missing
            {row.guideName ? ` · ${row.guideName}` : ""}
            {row.guidePhone ? ` · ${row.guidePhone}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-xs font-semibold text-sky-900 dark:text-sky-100">
            Guide {row.guideNumber}
          </p>
        )}
        {row.guideMissing ? (
          <p className="text-[11px] text-muted-foreground">
            {agentContact
              ? `Ask ${row.agentName ?? "the agent"}: ${agentContact}`
              : "No phone or email on this agent"}
          </p>
        ) : null}
      </div>
      {row.guideMissing ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            const result = await saveBookingGuideNumber({
              bookingId: row.bookingId,
              guideNumber: value,
            });
            setPending(false);
            if (!result.ok) setError(result.error);
            else setValue("");
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Guide number"
            aria-label={`Guide number for ${row.guestName}`}
            className="h-8 w-32 rounded-md border bg-background px-2 text-xs"
          />
          <button
            type="submit"
            disabled={pending || !value.trim()}
            className="h-8 rounded-md bg-foreground px-2 text-xs font-medium text-background disabled:opacity-50"
          >
            {pending ? "…" : "Save"}
          </button>
          {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
        </form>
      ) : null}
    </li>
  );
}
