import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Badge,
  Button,
  GlassPanel,
  KpiCard,
  ModuleFrame,
} from "@hos-v2/ui";
import {
  formatNu,
  folioBalance,
  useFrontOfficeStore,
} from "../lib/front-office-store";
import { useFnbStore } from "../lib/fnb-store";
import { useFiscalStore } from "../lib/fiscal-store";
import {
  purchaseCategoryLabel,
  type PurchaseCategoryId,
} from "../lib/fiscal-store";
import { useExtrasStore } from "../lib/extras-store";
import { useCommercialStore } from "../lib/commercial-store";
import { useEnterpriseOpsStore } from "../lib/enterprise-ops-store";
import {
  buildOwnerGlance,
  type OwnerPeriodKind,
} from "../lib/owner-glance";

export function OwnerPage() {
  const reduce = useReducedMotion();
  const [periodKind, setPeriodKind] = useState<OwnerPeriodKind>("ytd");
  const [alertsOpen, setAlertsOpen] = useState(false);

  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const stays = useFrontOfficeStore((s) => s.stays);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const orders = useFnbStore((s) => s.orders);
  const kots = useFnbStore((s) => s.kots);
  const tillBalance = useFiscalStore((s) => s.tillBalance);
  const purchases = useFiscalStore((s) => s.purchases);
  const fiscalDocs = useExtrasStore((s) => s.fiscalDocs);
  const tillShifts = useExtrasStore((s) => s.tillShifts);
  const agents = useCommercialStore((s) => s.agents);
  const season = useCommercialStore((s) => s.season);
  const hrStaff = useEnterpriseOpsStore((s) => s.hrStaff);

  const pulse = useMemo(
    () => useExtrasStore.getState().ownerPulse(),
    [stays, rooms, orders, tillShifts, tillBalance],
  );

  const roomsCount =
    rooms.filter((r) => r.hkStatus !== "ooo").length || rooms.length || 1;

  const glance = useMemo(
    () =>
      buildOwnerGlance({
        kind: periodKind,
        asOf: businessDate,
        season,
        stays,
        roomsCount,
        purchases,
        fiscalDocs,
        agents,
        staff: hrStaff,
      }),
    [
      periodKind,
      businessDate,
      season,
      stays,
      roomsCount,
      purchases,
      fiscalDocs,
      agents,
      hrStaff,
    ],
  );

  const inHouse = stays.filter((s) => s.status === "checked_in");
  const radar: { severity: "high" | "med"; text: string }[] = [];
  const openShift = tillShifts.find((t) => !t.closedAt);
  if (openShift && openShift.counted == null) {
    radar.push({ severity: "med", text: "Cash drawer still open — count before night close" });
  }
  if (tillBalance > 80000) {
    radar.push({
      severity: "high",
      text: `Cash in drawer ${formatNu(tillBalance)} — bank drop recommended`,
    });
  }
  for (const k of kots.filter((x) => x.status === "cancelled")) {
    radar.push({
      severity: "high",
      text: `Cancelled kitchen ticket ${k.ticketNo}`,
    });
  }
  for (const a of agents) {
    if (a.creditLimit > 0 && a.usedCredit / a.creditLimit > 0.9) {
      radar.push({
        severity: "high",
        text: `${a.name} has used ${Math.round((a.usedCredit / a.creditLimit) * 100)}% of credit`,
      });
    }
  }
  for (const s of inHouse.filter((x) => folioBalance(x) > 25000)) {
    radar.push({
      severity: "med",
      text: `Room ${s.roomNumber} still owes ${formatNu(folioBalance(s))}`,
    });
  }

  const maxMonthOcc = Math.max(1, ...glance.monthBars.map((m) => m.occPct));
  const periodBtns: { id: OwnerPeriodKind; label: string }[] = [
    { id: "ytd", label: "This year" },
    { id: "season", label: "This season" },
    { id: "month", label: "This month" },
  ];

  return (
    <ModuleFrame
      title="Owner"
      description="How the hotel is doing — rooms filled, money in and out, and who brings guests"
      actions={
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Period">
          {periodBtns.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setPeriodKind(b.id)}
              className={`min-h-10 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                periodKind === b.id
                  ? "bg-[var(--hos-primary)] text-white"
                  : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink)]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[12px] text-[var(--hos-ink-3)]">
          Showing <strong className="text-[var(--hos-ink-2)]">{glance.period.label}</strong>{" "}
          ({glance.period.from} → {glance.period.to})
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Rooms filled"
            value={`${glance.occPct}%`}
            delta={`${glance.roomNightsSold} of ${glance.roomNightsCapacity} room-nights`}
          />
          <KpiCard
            label="Money in"
            value={formatNu(glance.moneyIn)}
            delta={`${glance.income.bookings} bookings · collected ${formatNu(glance.income.collected)}`}
          />
          <KpiCard
            label="Money out"
            value={formatNu(glance.moneyOut)}
            delta={`${glance.expense.count} bills on the books`}
          />
          <KpiCard
            label="Left as profit"
            value={formatNu(glance.profit)}
            delta={
              glance.profit >= 0 ? "Money in minus money out" : "Spending ahead of income"
            }
          />
        </div>

        <GlassPanel className="p-3.5" data-testid="owner-today-strip">
          <strong className="text-sm text-[var(--hos-ink)]">Today at a glance</strong>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
              <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Rooms filled today</div>
              <strong className="tabular-nums">{pulse.occPct}%</strong>
            </div>
            <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
              <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Today’s sales</div>
              <strong className="tabular-nums">{formatNu(pulse.gross)}</strong>
            </div>
            <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
              <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Avg room rate</div>
              <strong className="tabular-nums">{formatNu(pulse.adr)}</strong>
              <div className="text-[10px] text-[var(--hos-ink-3)]">More detail</div>
            </div>
            <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
              <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Rev per room</div>
              <strong className="tabular-nums">{formatNu(pulse.revpar)}</strong>
              <div className="text-[10px] text-[var(--hos-ink-3)]">More detail</div>
            </div>
          </div>
        </GlassPanel>

        {glance.monthBars.length > 0 ? (
          <GlassPanel className="p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">How full by month</strong>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
              Room-nights sold vs capacity — opaque bars for desk readability
            </p>
            <ul className="m-0 mt-3 flex list-none flex-wrap items-end gap-2 p-0">
              {glance.monthBars.map((m) => (
                <li key={m.key} className="flex w-12 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-[var(--hos-primary)]"
                    style={{
                      height: `${Math.max(4, Math.round((m.occPct / maxMonthOcc) * 64))}px`,
                    }}
                    title={`${m.label}: ${m.occPct}%`}
                  />
                  <span className="text-[9px] font-semibold text-[var(--hos-ink-3)]">
                    {m.label.slice(0, 3)}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums">{m.occPct}%</span>
                </li>
              ))}
            </ul>
          </GlassPanel>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <GlassPanel className="p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <strong className="text-sm text-[var(--hos-ink)]">Where did we spend?</strong>
                <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                  Top expense categories for this period
                </p>
              </div>
              <Link
                to="/finance?tab=expense"
                className="text-[12px] font-semibold text-[var(--hos-primary)] no-underline"
              >
                See all in Finance →
              </Link>
            </div>
            {glance.topExpenseCategories.length === 0 ? (
              <p className="mt-3 text-[12px] text-[var(--hos-ink-3)]">
                No purchase bills in this period yet.
              </p>
            ) : (
              <ul className="m-0 mt-3 list-none space-y-2 p-0">
                {glance.topExpenseCategories.map((c) => {
                  const pct =
                    glance.moneyOut > 0
                      ? Math.round((c.amount / glance.moneyOut) * 100)
                      : 0;
                  return (
                    <li key={c.category} className="text-xs">
                      <div className="mb-1 flex justify-between gap-2">
                        <span className="font-semibold text-[var(--hos-ink)]">
                          {purchaseCategoryLabel(c.category as PurchaseCategoryId)}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatNu(c.amount)} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                        <div
                          className="h-full rounded-full bg-[var(--hos-ruby)]"
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              to="/finance?tab=pl"
              className="mt-3 inline-block text-[12px] font-semibold text-[var(--hos-primary)] no-underline"
            >
              Open profit &amp; loss →
            </Link>
          </GlassPanel>

          <GlassPanel className="p-3.5" data-testid="owner-tile-top-agents">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <strong className="text-sm text-[var(--hos-ink)]">Who brings guests?</strong>
                <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                  Top producers · nights · money · typical rate
                </p>
              </div>
              <Link
                to="/reports?intel=agents"
                className="text-[12px] font-semibold text-[var(--hos-primary)] no-underline"
              >
                Agent insights →
              </Link>
            </div>
            {glance.topAgents.length === 0 ? (
              <p className="mt-3 text-[12px] text-[var(--hos-ink-3)]">
                No agent production in this period yet.
              </p>
            ) : (
              <ul className="m-0 mt-3 list-none space-y-2 p-0">
                {glance.topAgents.map((a, i) => (
                  <li key={a.agentId}>
                    <Link
                      to="/reports?intel=agents"
                      className="flex items-center justify-between gap-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2 text-[12px] no-underline transition hover:border-[var(--hos-brass)]/40"
                    >
                      <span className="min-w-0 font-semibold text-[var(--hos-ink)]">
                        #{i + 1} {a.agentName}
                        <span className="ml-1 font-normal text-[var(--hos-ink-3)]">
                          ({a.agentCode})
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--hos-ink-2)]">
                        {a.roomNights}n · {formatNu(a.revenue)}
                        <div className="text-[10px] text-[var(--hos-ink-3)]">
                          ~{formatNu(a.adr)} / night · unpaid {formatNu(a.unpaid)}
                        </div>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                Where guests come from
              </div>
              <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-1.5 p-0">
                {glance.sourceMix
                  .filter((s) => s.stayCount > 0)
                  .map((s) => (
                    <li key={s.source}>
                      <Badge tone="default">
                        {s.label} · {s.stayCount} · {s.roomNights}n
                      </Badge>
                    </li>
                  ))}
                {glance.sourceMix.every((s) => s.stayCount === 0) ? (
                  <li className="text-[11px] text-[var(--hos-ink-3)]">No stays in period</li>
                ) : null}
              </ul>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
              <Link
                to="/reservations"
                className="font-semibold text-[var(--hos-primary)] no-underline"
              >
                Reservations →
              </Link>
              <Link
                to="/agents"
                className="font-semibold text-[var(--hos-primary)] no-underline"
              >
                Agents desk →
              </Link>
            </div>
          </GlassPanel>
        </div>

        {glance.ops.byDept.length > 0 ? (
          <GlassPanel className="p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">Staffing cue (more)</strong>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
              Peak occ {glance.ops.peakOccPct}% · lean {glance.ops.leanOccPct}% ·{" "}
              {glance.ops.headcountActive} active on roster
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {glance.ops.byDept.slice(0, 3).map((d) => (
                <div
                  key={d.dept}
                  className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2 text-center text-[11px]"
                >
                  <div className="text-[9px] uppercase text-[var(--hos-ink-3)]">{d.dept}</div>
                  <div className="font-mono font-bold tabular-nums">
                    {d.active}{" "}
                    <span className="font-normal text-[var(--hos-ink-3)]">
                      (peak {d.recommendedPeak} / lean {d.recommendedLean})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        ) : null}

        <GlassPanel className="p-3.5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setAlertsOpen((o) => !o)}
            aria-expanded={alertsOpen}
          >
            <span>
              <strong className="text-sm text-[var(--hos-ink)]">Desk alerts</strong>
              <span className="ml-2 text-[11px] text-[var(--hos-ink-3)]">
                {radar.filter((r) => r.severity === "high").length} urgent · {radar.length} total
              </span>
            </span>
            <span className="text-[12px] font-semibold text-[var(--hos-primary)]">
              {alertsOpen ? "Hide" : "Show"}
            </span>
          </button>
          {alertsOpen ? (
            <div className="mt-3 flex flex-col gap-3">
              {radar.length === 0 ? (
                <p className="m-0 text-xs text-[var(--hos-ink-3)]">Nothing urgent right now.</p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {radar.slice(0, 8).map((f) => (
                    <li
                      key={f.text}
                      className={`rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs font-medium ${
                        f.severity === "high"
                          ? "text-[var(--hos-ruby)]"
                          : "text-[var(--hos-brass-ink)]"
                      }`}
                    >
                      <Badge tone={f.severity === "high" ? "danger" : "vip"} className="mr-2">
                        {f.severity === "high" ? "Urgent" : "Watch"}
                      </Badge>
                      {f.text}
                    </li>
                  ))}
                </ul>
              )}
              <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                <strong className="text-xs text-[var(--hos-ink)]">Evening summary (preview)</strong>
                <pre className="m-0 mt-2 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-[var(--hos-ink-2)]">
                  {`${businessDate} — ${glance.period.label}\nRooms filled ${glance.occPct}% · Money in ${formatNu(glance.moneyIn)} · Money out ${formatNu(glance.moneyOut)} · Profit ${formatNu(glance.profit)}\nToday occ ${pulse.occPct}% · drawer ${formatNu(tillBalance)} · alerts ${radar.filter((r) => r.severity === "high").length}`}
                </pre>
                <motion.div
                  className="mt-2"
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      toast.success("Test summary ready", {
                        description: "Simulated Owner / GM message (not sent)",
                      })
                    }
                  >
                    Test summary toast
                  </Button>
                </motion.div>
              </div>
            </div>
          ) : null}
        </GlassPanel>
      </div>
    </ModuleFrame>
  );
}
