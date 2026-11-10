"use client";

import { Badge } from "@/components/ui/badge";
import type { KitchenMealService } from "@/lib/kitchen/meal-service";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export type KitchenEventSnack = {
  id: string;
  title: string;
  serviceTime: string | null;
  serviceEnd?: string | null;
  covers: number;
  mealPeriod: string;
  menuNote: string | null;
  venue?: string | null;
  packageTotalBtn?: number | null;
  billingStatus?: string | null;
};

export function MealServiceBoard({
  services,
  events = [],
  businessDate,
  title = "Kitchen feed",
  emptyHint = "Kitchen has not published BF / lunch / dinner for this date yet.",
  compact = false,
}: {
  services: KitchenMealService[];
  events?: KitchenEventSnack[];
  businessDate: string;
  title?: string;
  emptyHint?: string;
  /** Single-line collapsed chip for POS register. */
  compact?: boolean;
}) {
  const hasContent = services.length > 0 || events.length > 0;
  const [open, setOpen] = useState(!compact && hasContent);

  if (compact && !hasContent) {
    return (
      <p className="text-xs text-muted-foreground">
        {emptyHint}{" "}
        <Link
          href="/erp/kitchen"
          className="text-accent underline-offset-4 hover:underline"
        >
          Kitchen →
        </Link>
      </p>
    );
  }

  const summaryBits = [
    ...services.map(
      (s) =>
        `${LABELS[s.mealPeriod] ?? s.mealPeriod} ${s.heads}`,
    ),
    ...events.map(
      (e) =>
        `${e.title}${e.serviceTime ? ` ${e.serviceTime.slice(0, 5)}` : ""} · ${e.covers}`,
    ),
  ];

  if (compact) {
    return (
      <div className="rounded-lg border bg-card">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left"
          aria-expanded={open}
        >
          <span className="min-w-0 truncate text-sm">
            <span className="font-medium text-foreground">{title}</span>
            <span className="text-muted-foreground">
              {" · "}
              {summaryBits.join(" · ") || businessDate}
            </span>
          </span>
          <ChevronDownIcon
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open ? (
          <div className="space-y-3 border-t px-3 py-3">
            <FeedBody services={services} events={events} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-card ${
        hasContent ? "border-citrus/40 bg-citrus-tint/20" : ""
      }`}
    >
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">
          Kitchen feed for FO / F&amp;B · {businessDate}
        </p>
      </div>
      <div className="border-t px-4 py-3">
        {!hasContent ? (
          <p className="text-sm text-muted-foreground">
            {emptyHint}{" "}
            <Link
              href="/erp/kitchen"
              className="text-accent underline-offset-4 hover:underline"
            >
              Kitchen board →
            </Link>
          </p>
        ) : (
          <FeedBody services={services} events={events} />
        )}
      </div>
    </div>
  );
}

function FeedBody({
  services,
  events,
}: {
  services: KitchenMealService[];
  events: KitchenEventSnack[];
}) {
  return (
    <div className="space-y-3">
      {events.length > 0 ? (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li key={ev.id} className="rounded-lg border bg-background p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="gold">Event</Badge>
                <span className="text-sm font-medium">{ev.title}</span>
                {ev.serviceTime || ev.serviceEnd ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {ev.serviceTime ? ev.serviceTime.slice(0, 5) : "—"}
                    {ev.serviceEnd
                      ? `–${ev.serviceEnd.slice(0, 5)}`
                      : ""}
                  </span>
                ) : null}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {ev.covers} pax · {ev.mealPeriod}
                </span>
                {ev.venue ? (
                  <span className="text-xs text-muted-foreground">{ev.venue}</span>
                ) : null}
                {ev.packageTotalBtn != null && ev.packageTotalBtn > 0 ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Nu {ev.packageTotalBtn.toFixed(0)}
                    {ev.billingStatus && ev.billingStatus !== "none"
                      ? ` · ${ev.billingStatus}`
                      : ""}
                  </span>
                ) : null}
              </div>
              {ev.menuNote ? (
                <p className="mt-1 text-xs text-foreground whitespace-pre-wrap">
                  {ev.menuNote}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {services.length === 0 && events.length === 0 ? null : services.length ===
        0 ? null : (
        <ul className="space-y-3">
          {services.map((svc) => (
            <li key={svc.id} className="rounded-lg border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {LABELS[svc.mealPeriod] ?? svc.mealPeriod}
                  </Badge>
                  <span className="text-lg font-semibold tabular-nums">
                    {svc.heads}
                  </span>
                  <span className="text-xs text-muted-foreground">heads</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(svc.publishedAt).toISOString().slice(11, 16)} UTC
                  {svc.publishedBy ? ` · ${svc.publishedBy}` : ""}
                </span>
              </div>
              {svc.menuNote ? (
                <p className="mt-2 text-sm text-foreground">{svc.menuNote}</p>
              ) : null}
              {svc.menuHighlights ? (
                <p className="mt-1 text-xs font-medium text-accent">
                  Highlight: {svc.menuHighlights}
                </p>
              ) : null}
              {svc.guestFeed.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                    Guest list ({svc.guestFeed.length})
                  </summary>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-xs">
                    {svc.guestFeed.map((g) => (
                      <li
                        key={`${svc.id}-${g.bookingId}`}
                        className="flex justify-between gap-2 border-t py-1"
                      >
                        <span>
                          <Link
                            href={`/erp/bookings/${g.bookingId}`}
                            className="font-medium hover:text-accent"
                          >
                            {g.guestName}
                          </Link>
                          <span className="text-muted-foreground">
                            {" "}
                            · {g.rooms || "—"} · {g.mealPlanCode}
                          </span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {g.adults} pax
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
