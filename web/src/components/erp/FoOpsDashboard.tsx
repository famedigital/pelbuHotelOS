"use client";

import type { DailyDeskSnapshot } from "@/lib/erp/daily-desk";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";

function Block({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-md border border-border bg-card",
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-border/80 px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </header>
      <div className="p-2">{children}</div>
    </section>
  );
}

function MealBuckets({
  buckets,
}: {
  buckets: DailyDeskSnapshot["arrivalMealBuckets"];
}) {
  if (buckets.length === 0) {
    return (
      <p className="px-1 text-xs text-muted-foreground">No meal-plan stays.</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {buckets.map((b) => (
        <li
          key={b.code}
          className="rounded border bg-muted/40 px-2 py-1 text-[11px] tabular-nums"
        >
          <span className="font-semibold">{b.code}</span> · {b.rooms} rm ·{" "}
          {b.pax} pax
        </li>
      ))}
    </ul>
  );
}

function MiniTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-xs">
        <thead>
          <tr className="border-b text-[10px] uppercase tracking-wide text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="px-1.5 py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Seven FO ops blocks — StayView primary board. */
export function FoOpsDashboard({ snap }: { snap: DailyDeskSnapshot }) {
  const { dayOps, emptyRooms, departureInvoices } = snap;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Block
        title="Today checkout"
        subtitle={`${dayOps.departures.length} due`}
        className="lg:col-span-2"
      >
        {dayOps.departures.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No checkouts today.</p>
        ) : (
          <MiniTable
            headers={["Room", "Guest", "Agent", "Guide", "Invoice", ""]}
          >
            {dayOps.departures.map((r) => {
              const inv = r.folio_id
                ? departureInvoices[r.folio_id]
                : undefined;
              return (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="px-1.5 py-1.5 font-medium">
                    {r.room_labels ?? "—"}
                  </td>
                  <td className="max-w-[8rem] truncate px-1.5 py-1.5">
                    {r.contact_name ?? "Guest"}
                  </td>
                  <td className="max-w-[7rem] truncate px-1.5 py-1.5 text-muted-foreground">
                    {r.agent_name ?? "—"}
                  </td>
                  <td className="px-1.5 py-1.5 text-muted-foreground">
                    {r.guide_number ?? "—"}
                  </td>
                  <td className="px-1.5 py-1.5 font-mono text-[11px]">
                    {inv ? (
                      <Link
                        href={`/erp/invoices/${inv.id}/print?bill=master`}
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        {inv.docNo}
                      </Link>
                    ) : (
                      <span className="text-destructive">No INV</span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-right">
                    {r.folio_id ? (
                      inv ? (
                        <Link
                          href={`/erp/folios/${r.folio_id}`}
                          className="text-accent underline-offset-2 hover:underline"
                        >
                          Folio
                        </Link>
                      ) : (
                        <Link
                          href={`/erp/folios/${r.folio_id}#folio-invoice`}
                          className="font-medium text-accent underline-offset-2 hover:underline"
                        >
                          Create INV
                        </Link>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </MiniTable>
        )}
      </Block>

      <Block
        title="Today arrival"
        subtitle={`${dayOps.arrivals.length} · ${dayOps.arrivingMealPax} meal pax`}
      >
        <div className="mb-2">
          <MealBuckets buckets={snap.arrivalMealBuckets} />
        </div>
        {dayOps.arrivals.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No arrivals today.</p>
        ) : (
          <MiniTable headers={["Rooms", "Guest", "Guide", "Meal", "Assign"]}>
            {dayOps.arrivals.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="px-1.5 py-1.5">
                  {r.room_labels ?? `${r.rooms} rm`}
                </td>
                <td className="max-w-[8rem] truncate px-1.5 py-1.5">
                  <Link
                    href={`/erp/calendar?booking=${r.id}`}
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {r.contact_name ?? "Guest"}
                  </Link>
                </td>
                <td className="px-1.5 py-1.5 text-muted-foreground">
                  {r.guide_number ?? "—"}
                </td>
                <td className="px-1.5 py-1.5">{r.meal_plan_code}</td>
                <td className="px-1.5 py-1.5">
                  {r.assigned_count > 0 ? (
                    <span className="text-muted-foreground">
                      {r.assigned_count} asg
                    </span>
                  ) : (
                    <span className="font-medium text-destructive">Unassigned</span>
                  )}
                </td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Block>

      <Block
        title="Today in-house"
        subtitle={`${dayOps.inHouse.length} stays · ${dayOps.inHouseMealPax} meal pax`}
      >
        <MealBuckets buckets={snap.inHouseMealBuckets} />
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          BF {snap.dayOpsPulse.breakfast} · L {snap.dayOpsPulse.lunch} · D{" "}
          {snap.dayOpsPulse.dinner} covers
        </p>
      </Block>

      <Block
        title="Follow-up"
        subtitle={`${snap.agentUnpaidCount} unpaid / AR`}
        className="lg:col-span-2"
      >
        <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
          <Link
            href="/erp/bills?tab=owes"
            className="text-accent underline-offset-2 hover:underline"
          >
            Who owes
          </Link>
          <Link
            href="/erp/bills?tab=invoices"
            className="text-accent underline-offset-2 hover:underline"
          >
            Invoices
          </Link>
          <span className="text-muted-foreground">
            Tomorrow guide gaps:{" "}
            {
              snap.tomorrowArrivals.filter((a) => a.guideMissing).length
            }
          </span>
        </div>
        {snap.agentFollowup.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            No agent pay follow-ups.
          </p>
        ) : (
          <MiniTable headers={["Guest", "Agent", "Guide", "Due", "Status"]}>
            {snap.agentFollowup.slice(0, 12).map((r) => (
              <tr key={r.bookingId} className="border-b border-border/50">
                <td className="max-w-[8rem] truncate px-1.5 py-1.5">
                  {r.folioId ? (
                    <Link
                      href={`/erp/folios/${r.folioId}`}
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      {r.guestName}
                    </Link>
                  ) : (
                    r.guestName
                  )}
                </td>
                <td className="max-w-[7rem] truncate px-1.5 py-1.5 text-muted-foreground">
                  {r.agentName ?? "—"}
                </td>
                <td className="px-1.5 py-1.5 text-muted-foreground">
                  {r.guideNumber ?? "—"}
                </td>
                <td className="px-1.5 py-1.5 tabular-nums">
                  {formatBtn(r.balanceBtn)}
                </td>
                <td className="px-1.5 py-1.5 capitalize text-muted-foreground">
                  {r.payStatus.replace(/_/g, " ")}
                </td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Block>

      <Block
        title="Tomorrow arrival"
        subtitle={`${snap.tomorrowArrivals.length}`}
      >
        {snap.tomorrowArrivals.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">None.</p>
        ) : (
          <ul className="space-y-1">
            {snap.tomorrowArrivals.slice(0, 10).map((a) => (
              <li
                key={a.bookingId}
                className="flex items-center justify-between gap-2 px-1 text-xs"
              >
                <span className="min-w-0 truncate">
                  <Link
                    href={`/erp/calendar?booking=${a.bookingId}`}
                    className="font-medium text-accent underline-offset-2 hover:underline"
                  >
                    {a.guestName}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    · {a.agentName ?? "direct"} · {a.mealPlanCode ?? "EP"}
                  </span>
                </span>
                <span
                  className={
                    a.guideMissing
                      ? "shrink-0 text-destructive"
                      : "shrink-0 text-muted-foreground"
                  }
                >
                  {a.guideMissing ? "No guide#" : a.guideNumber}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block
        title="Tomorrow checkout"
        subtitle={`${snap.tomorrowDepartures.length}`}
      >
        {snap.tomorrowDepartures.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">None.</p>
        ) : (
          <ul className="space-y-1">
            {snap.tomorrowDepartures.slice(0, 10).map((d) => (
              <li
                key={d.bookingId}
                className="flex items-center justify-between gap-2 px-1 text-xs"
              >
                <span className="min-w-0 truncate">
                  {d.roomLabel ?? "—"} · {d.guestName}
                  <span className="text-muted-foreground">
                    {" "}
                    · {d.agentName ?? "direct"}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatBtn(d.balanceBtn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block
        title="Empty rooms"
        subtitle={`${emptyRooms.vacant} vacant / ${emptyRooms.sellableTotal} sellable`}
        className="lg:col-span-2"
      >
        <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded border px-2 py-1">
            Vacant <strong>{emptyRooms.vacant}</strong>
          </span>
          <span className="rounded border px-2 py-1">
            Occupied <strong>{emptyRooms.occupiedToday}</strong>
          </span>
          <span className="rounded border px-2 py-1">
            Held <strong>{emptyRooms.heldToday}</strong>
          </span>
          <span className="rounded border px-2 py-1">
            OOO <strong>{emptyRooms.ooo}</strong>
          </span>
          <span className="rounded border px-2 py-1">
            Dirty vacant <strong>{emptyRooms.dirtyVacant}</strong>
          </span>
        </div>
        <MiniTable headers={["Type", "Total", "Occ", "Vacant", "OOO"]}>
          {emptyRooms.byType.map((t) => (
            <tr key={t.code} className="border-b border-border/50">
              <td className="px-1.5 py-1.5">
                {t.code}{" "}
                <span className="text-muted-foreground">{t.name}</span>
              </td>
              <td className="px-1.5 py-1.5 tabular-nums">{t.total}</td>
              <td className="px-1.5 py-1.5 tabular-nums">{t.occupied}</td>
              <td className="px-1.5 py-1.5 tabular-nums">{t.vacant}</td>
              <td className="px-1.5 py-1.5 tabular-nums">{t.ooo}</td>
            </tr>
          ))}
        </MiniTable>
      </Block>
    </div>
  );
}
