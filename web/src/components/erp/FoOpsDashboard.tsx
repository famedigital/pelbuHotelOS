"use client";

import {
  FoCreateInvButton,
  FoPrintBillButton,
  FoStayActionButton,
  useFoOpsOpenStay,
} from "@/components/erp/FoOpsRowActions";
import { CheckInDueButton } from "@/components/erp/CheckInDueButton";
import type { DailyDeskSnapshot } from "@/lib/erp/daily-desk";
import type { DayOpsRow } from "@/lib/erp/day-ops-board";
import { fmtDate } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";

function Block({
  title,
  subtitle,
  href,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  href?: string;
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
        {href ? (
          <Link
            href={href}
            className="text-sm font-semibold tracking-tight text-accent underline-offset-2 hover:underline"
          >
            {title}
          </Link>
        ) : (
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        )}
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
  className,
}: {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("hidden overflow-x-auto md:block", className)}>
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

function MobileCardList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2 md:hidden">{children}</ul>;
}

function GuestLink({
  name,
  onOpen,
}: {
  name: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="max-w-full truncate text-left font-medium text-accent underline-offset-2 hover:underline"
    >
      {name}
    </button>
  );
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">{children}</div>
  );
}

/** Seven FO ops blocks — StayView primary board (actionable). */
export function FoOpsDashboard({
  snap,
  onInvalidate,
}: {
  snap: DailyDeskSnapshot;
  onInvalidate?: () => void | Promise<void>;
}) {
  const { dayOps, emptyRooms, departureInvoices } = snap;
  const dueArrivals = snap.dueArrivals ?? dayOps.dueArrivals ?? dayOps.arrivals;
  const openStay = useFoOpsOpenStay();
  const refresh = () => {
    void onInvalidate?.();
  };

  const biz = snap.businessDate;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Block
        title="Today checkout"
        subtitle={`${dayOps.departures.length} due`}
        href="/erp/departures"
        className="lg:col-span-2"
      >
        {dayOps.departures.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No checkouts today.</p>
        ) : (
          <>
            <MiniTable
              headers={["Room", "Guest", "Agent", "Guide", "Invoice", "Actions"]}
            >
              {dayOps.departures.map((r) => (
                <DepartureTableRow
                  key={r.id}
                  r={r}
                  inv={r.folio_id ? departureInvoices[r.folio_id] : undefined}
                  openStay={openStay}
                  onRefresh={refresh}
                />
              ))}
            </MiniTable>
            <MobileCardList>
              {dayOps.departures.map((r) => (
                <DepartureCard
                  key={r.id}
                  r={r}
                  inv={r.folio_id ? departureInvoices[r.folio_id] : undefined}
                  openStay={openStay}
                  onRefresh={refresh}
                />
              ))}
            </MobileCardList>
          </>
        )}
      </Block>

      <Block
        title="Check-in through today"
        subtitle={`${dueArrivals.length} due · ${dayOps.arrivingMealPax} meal pax today`}
        href="/erp/arrivals"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <MealBuckets buckets={snap.arrivalMealBuckets} />
          <CheckInDueButton count={dueArrivals.length} onDone={onInvalidate} />
        </div>
        {dueArrivals.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            No reservations left to check in through today.
          </p>
        ) : (
          <>
            <MiniTable headers={["Rooms", "Guest", "Guide", "Meal", "Actions"]}>
              {dueArrivals.map((r) => (
                <ArrivalTableRow
                  key={r.id}
                  r={r}
                  openStay={openStay}
                />
              ))}
            </MiniTable>
            <MobileCardList>
              {dueArrivals.map((r) => (
                <ArrivalCard key={r.id} r={r} openStay={openStay} />
              ))}
            </MobileCardList>
          </>
        )}
      </Block>

      <Block
        title="Today in-house"
        subtitle={`${dayOps.inHouse.length} stays · ${dayOps.inHouseMealPax} meal pax`}
        href="/erp/in-house"
      >
        <MealBuckets buckets={snap.inHouseMealBuckets} />
        <p className="mt-2 mb-2 px-1 text-[11px] text-muted-foreground">
          BF {snap.dayOpsPulse.breakfast} · L {snap.dayOpsPulse.lunch} · D{" "}
          {snap.dayOpsPulse.dinner} covers
        </p>
        {dayOps.inHouse.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No one in-house.</p>
        ) : (
          <>
            <MiniTable headers={["Room", "Guest", "Meal", "Balance", "Actions"]}>
              {dayOps.inHouse.slice(0, 12).map((r) => (
                <InHouseTableRow key={r.id} r={r} openStay={openStay} />
              ))}
            </MiniTable>
            <MobileCardList>
              {dayOps.inHouse.slice(0, 12).map((r) => (
                <InHouseCard key={r.id} r={r} openStay={openStay} />
              ))}
            </MobileCardList>
            {dayOps.inHouse.length > 12 ? (
              <p className="mt-2 px-1 text-[11px]">
                <Link
                  href="/erp/in-house"
                  className="text-accent underline-offset-2 hover:underline"
                >
                  View all {dayOps.inHouse.length}
                </Link>
              </p>
            ) : null}
          </>
        )}
      </Block>

      <Block
        title="Follow-up"
        subtitle={`${snap.agentUnpaidCount} unpaid / AR`}
        href="/erp/bills?tab=owes"
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
            {snap.tomorrowArrivals.filter((a) => a.guideMissing).length}
          </span>
        </div>
        {snap.agentFollowup.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            No agent pay follow-ups.
          </p>
        ) : (
          <>
            <MiniTable headers={["Guest", "Agent", "Guide", "Due", "Actions"]}>
              {snap.agentFollowup.slice(0, 12).map((r) => (
                <tr key={r.bookingId} className="border-b border-border/50">
                  <td className="max-w-[8rem] truncate px-1.5 py-1.5">
                    <GuestLink
                      name={r.guestName}
                      onOpen={() =>
                        openStay(
                          {
                            id: r.bookingId,
                            status: "checked_in",
                            folio_balance_btn: r.balanceBtn,
                            assigned_count: 1,
                            check_in: null,
                          },
                          "departures",
                          "stay_money",
                        )
                      }
                    />
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
                  <td className="px-1.5 py-1.5">
                    <ActionRow>
                      <FoStayActionButton
                        label="Collect"
                        variant="default"
                        onClick={() =>
                          openStay(
                            {
                              id: r.bookingId,
                              status: "checked_in",
                              folio_balance_btn: r.balanceBtn,
                              assigned_count: 1,
                              check_in: null,
                            },
                            "departures",
                            "stay_money",
                          )
                        }
                      />
                    </ActionRow>
                  </td>
                </tr>
              ))}
            </MiniTable>
            <MobileCardList>
              {snap.agentFollowup.slice(0, 12).map((r) => (
                <li
                  key={r.bookingId}
                  className="rounded-md border border-border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <GuestLink
                        name={r.guestName}
                        onOpen={() =>
                          openStay(
                            {
                              id: r.bookingId,
                              status: "checked_in",
                              folio_balance_btn: r.balanceBtn,
                              assigned_count: 1,
                              check_in: null,
                            },
                            "departures",
                            "stay_money",
                          )
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {r.agentName ?? "—"} · {formatBtn(r.balanceBtn)}
                      </p>
                    </div>
                    <FoStayActionButton
                      label="Collect"
                      variant="default"
                      className="min-h-11"
                      onClick={() =>
                        openStay(
                          {
                            id: r.bookingId,
                            status: "checked_in",
                            folio_balance_btn: r.balanceBtn,
                            assigned_count: 1,
                            check_in: null,
                          },
                          "departures",
                          "stay_money",
                        )
                      }
                    />
                  </div>
                </li>
              ))}
            </MobileCardList>
          </>
        )}
      </Block>

      <Block
        title="Tomorrow arrival"
        subtitle={`${snap.tomorrowArrivals.length}`}
        href="/erp/arrivals"
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
                  <button
                    type="button"
                    className="font-medium text-accent underline-offset-2 hover:underline"
                    onClick={() =>
                      openStay(
                        {
                          id: a.bookingId,
                          status: "confirmed",
                          folio_balance_btn: null,
                          assigned_count: 0,
                          check_in: null,
                        },
                        "arrivals",
                        "arrival",
                      )
                    }
                  >
                    {a.guestName}
                  </button>
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
        href="/erp/departures"
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
                  <button
                    type="button"
                    className="font-medium text-accent underline-offset-2 hover:underline"
                    onClick={() =>
                      openStay(
                        {
                          id: d.bookingId,
                          status: "checked_in",
                          folio_balance_btn: d.balanceBtn,
                          assigned_count: 1,
                          check_in: null,
                        },
                        "in_house",
                        "stay_money",
                      )
                    }
                  >
                    {d.roomLabel ?? "—"} · {d.guestName}
                  </button>
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
        href="/erp/calendar"
        className="lg:col-span-2"
      >
        <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
          <Link
            href={`/erp/calendar/day-sheet?date=${biz}`}
            className="rounded border px-2 py-1 text-accent underline-offset-2 hover:underline"
          >
            Day sheet
          </Link>
          <Link
            href="/erp/calendar"
            className="rounded border px-2 py-1 text-accent underline-offset-2 hover:underline"
          >
            Rack
          </Link>
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
        <MiniTable
          headers={["Type", "Total", "Occ", "Vacant", "OOO"]}
          className="!block"
        >
          {emptyRooms.byType.map((t) => (
            <tr key={t.code} className="border-b border-border/50">
              <td className="px-1.5 py-1.5">
                <Link
                  href="/erp/calendar"
                  className="text-accent underline-offset-2 hover:underline"
                >
                  {t.code}
                </Link>{" "}
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

function DepartureTableRow({
  r,
  inv,
  openStay,
  onRefresh,
}: {
  r: DayOpsRow;
  inv?: { id: string; docNo: string };
  openStay: ReturnType<typeof useFoOpsOpenStay>;
  onRefresh: () => void;
}) {
  const invHref = inv
    ? `/erp/invoices/${inv.id}/print?bill=master`
    : null;
  const balance = Number(r.folio_balance_btn ?? 0);
  return (
    <tr className="border-b border-border/50">
      <td className="px-1.5 py-1.5 font-medium">{r.room_labels ?? "—"}</td>
      <td className="max-w-[8rem] truncate px-1.5 py-1.5">
        <GuestLink
          name={r.contact_name ?? "Guest"}
          onOpen={() => openStay(r, "departures", "check_out")}
        />
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
            href={invHref!}
            className="text-accent underline-offset-2 hover:underline"
          >
            {inv.docNo}
          </Link>
        ) : (
          <span className="text-destructive">No INV</span>
        )}
      </td>
      <td className="px-1.5 py-1.5">
        <ActionRow>
          {!inv && r.folio_id ? (
            <FoCreateInvButton folioId={r.folio_id} onIssued={onRefresh} />
          ) : null}
          <FoPrintBillButton folioId={r.folio_id} invHref={invHref} />
          {balance > 0.5 ? (
            <FoStayActionButton
              label="Collect"
              onClick={() => openStay(r, "departures", "stay_money")}
            />
          ) : null}
          <FoStayActionButton
            label="Check out"
            variant="default"
            onClick={() => openStay(r, "departures", "check_out")}
          />
        </ActionRow>
      </td>
    </tr>
  );
}

function DepartureCard({
  r,
  inv,
  openStay,
  onRefresh,
}: {
  r: DayOpsRow;
  inv?: { id: string; docNo: string };
  openStay: ReturnType<typeof useFoOpsOpenStay>;
  onRefresh: () => void;
}) {
  const invHref = inv
    ? `/erp/invoices/${inv.id}/print?bill=master`
    : null;
  const balance = Number(r.folio_balance_btn ?? 0);
  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">
            {r.room_labels ?? "—"}
          </p>
          <GuestLink
            name={r.contact_name ?? "Guest"}
            onOpen={() => openStay(r, "departures", "check_out")}
          />
          <p className="text-[11px] text-muted-foreground">
            {r.agent_name ?? "direct"}
            {inv ? ` · ${inv.docNo}` : " · No INV"}
          </p>
        </div>
      </div>
      <ActionRow>
        {!inv && r.folio_id ? (
          <FoCreateInvButton
            folioId={r.folio_id}
            onIssued={onRefresh}
            className="[&_button]:min-h-11"
          />
        ) : null}
        <FoPrintBillButton
          folioId={r.folio_id}
          invHref={invHref}
          className="min-h-11"
        />
        {balance > 0.5 ? (
          <FoStayActionButton
            label="Collect"
            className="min-h-11"
            onClick={() => openStay(r, "departures", "stay_money")}
          />
        ) : null}
        <FoStayActionButton
          label="Check out"
          variant="default"
          className="min-h-11"
          onClick={() => openStay(r, "departures", "check_out")}
        />
      </ActionRow>
    </li>
  );
}

function ArrivalTableRow({
  r,
  openStay,
}: {
  r: DayOpsRow;
  openStay: ReturnType<typeof useFoOpsOpenStay>;
}) {
  const unassigned = (r.assigned_count ?? 0) === 0;
  return (
    <tr className="border-b border-border/50">
      <td className="px-1.5 py-1.5">{r.room_labels ?? `${r.rooms} rm`}</td>
      <td className="max-w-[8rem] truncate px-1.5 py-1.5">
        <GuestLink
          name={r.contact_name ?? "Guest"}
          onOpen={() => openStay(r, "arrivals", "check_in")}
        />
        {r.check_in ? (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {fmtDate(r.check_in)}
          </p>
        ) : null}
      </td>
      <td className="px-1.5 py-1.5 text-muted-foreground">
        {r.guide_number ?? "—"}
      </td>
      <td className="px-1.5 py-1.5">{r.meal_plan_code}</td>
      <td className="px-1.5 py-1.5">
        <ActionRow>
          {unassigned ? (
            <FoStayActionButton
              label="Assign"
              variant="default"
              onClick={() => openStay(r, "arrivals", "check_in")}
            />
          ) : (
            <span className="mr-1 text-[11px] text-muted-foreground">
              {r.assigned_count} asg
            </span>
          )}
          <FoStayActionButton
            label="Check in"
            onClick={() => openStay(r, "arrivals", "check_in")}
          />
        </ActionRow>
      </td>
    </tr>
  );
}

function ArrivalCard({
  r,
  openStay,
}: {
  r: DayOpsRow;
  openStay: ReturnType<typeof useFoOpsOpenStay>;
}) {
  const unassigned = (r.assigned_count ?? 0) === 0;
  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="mb-2 min-w-0">
        <p className="text-[11px] text-muted-foreground">
          {r.room_labels ?? `${r.rooms} rm`} · {r.meal_plan_code}
          {r.check_in ? ` · ${fmtDate(r.check_in)}` : ""}
        </p>
        <GuestLink
          name={r.contact_name ?? "Guest"}
          onOpen={() => openStay(r, "arrivals", "check_in")}
        />
        {unassigned ? (
          <p className="text-[11px] font-medium text-destructive">Unassigned</p>
        ) : null}
      </div>
      <ActionRow>
        {unassigned ? (
          <FoStayActionButton
            label="Assign"
            variant="default"
            className="min-h-11"
            onClick={() => openStay(r, "arrivals", "check_in")}
          />
        ) : null}
        <FoStayActionButton
          label="Check in"
          className="min-h-11"
          onClick={() => openStay(r, "arrivals", "check_in")}
        />
      </ActionRow>
    </li>
  );
}

function InHouseTableRow({
  r,
  openStay,
}: {
  r: DayOpsRow;
  openStay: ReturnType<typeof useFoOpsOpenStay>;
}) {
  return (
    <tr className="border-b border-border/50">
      <td className="px-1.5 py-1.5 font-medium">{r.room_labels ?? "—"}</td>
      <td className="max-w-[8rem] truncate px-1.5 py-1.5">
        <GuestLink
          name={r.contact_name ?? "Guest"}
          onOpen={() => openStay(r, "in_house", "stay_money")}
        />
      </td>
      <td className="px-1.5 py-1.5">{r.meal_plan_code}</td>
      <td className="px-1.5 py-1.5 tabular-nums">
        {formatBtn(r.folio_balance_btn ?? 0)}
      </td>
      <td className="px-1.5 py-1.5">
        <ActionRow>
          <FoPrintBillButton folioId={r.folio_id} />
          <FoStayActionButton
            label="Folio"
            variant="default"
            onClick={() => openStay(r, "in_house", "stay_money")}
          />
        </ActionRow>
      </td>
    </tr>
  );
}

function InHouseCard({
  r,
  openStay,
}: {
  r: DayOpsRow;
  openStay: ReturnType<typeof useFoOpsOpenStay>;
}) {
  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="mb-2 min-w-0">
        <p className="text-[11px] text-muted-foreground">
          {r.room_labels ?? "—"} · {r.meal_plan_code}
        </p>
        <GuestLink
          name={r.contact_name ?? "Guest"}
          onOpen={() => openStay(r, "in_house", "stay_money")}
        />
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {formatBtn(r.folio_balance_btn ?? 0)}
        </p>
      </div>
      <ActionRow>
        <FoPrintBillButton folioId={r.folio_id} className="min-h-11" />
        <FoStayActionButton
          label="Folio"
          variant="default"
          className="min-h-11"
          onClick={() => openStay(r, "in_house", "stay_money")}
        />
      </ActionRow>
    </li>
  );
}
