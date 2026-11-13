import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  KpiCard,
} from "@hos-v2/ui";
import { useCommercialStore } from "../lib/commercial-store";
import { useFrontOfficeStore, formatNu } from "../lib/front-office-store";
import { useEnterpriseOpsStore } from "../lib/enterprise-ops-store";
import { buildSalarySheet } from "../lib/hr-payroll";
import { defaultPeriod, exportCsv } from "../lib/finance-reports";
import {
  buildAgentIntelligence,
  exportAgentIntelligenceCsv,
  type AgentIntelligenceRow,
} from "../lib/intelligence/agent-intelligence";
import {
  buildGuestIntelligence,
  exportGuestIntelligenceCsv,
  type GuestIntelligenceRow,
} from "../lib/intelligence/guest-intelligence";
import { buildOpsHrIntelligence } from "../lib/intelligence/ops-hr-intelligence";
import { AgentPrintPackOverlay } from "./AgentPrintPackOverlay";
import { useExtrasStore } from "../lib/extras-store";

type IntelTab = "agents" | "guests" | "ops";

function money(n: number) {
  return Math.round(n).toLocaleString("en-BT");
}

function MixChips({
  rows,
  empty,
}: {
  rows: { key: string; nights: number }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <span className="text-[11px] text-[var(--hos-ink-3)]">{empty}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {rows.slice(0, 6).map((r) => (
        <Badge key={r.key} tone="muted" className="!text-[10px]">
          {r.key} · {r.nights}n
        </Badge>
      ))}
    </div>
  );
}

function AgentDossierCard({
  row,
  rank,
  onPrintPack,
}: {
  row: AgentIntelligenceRow;
  rank: number;
  onPrintPack: () => void;
}) {
  return (
    <GlassPanel className="p-3.5" data-testid={`intel-agent-${row.agentCode}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
            #{rank} · {row.agentCode}
          </div>
          <strong className="text-sm text-[var(--hos-ink)]">{row.agentName}</strong>
          <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
            {row.roomNights} room-nights · {row.stayCount} stays · ADR{" "}
            {formatNu(row.adr)}
            {row.avgGapDays != null ? ` · every ~${row.avgGapDays}d` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={onPrintPack}>
            <Printer className="size-3.5" />
            Print pack
          </Button>
          <Link
            to="/agents"
            className="inline-flex min-h-9 items-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 text-[12px] font-semibold text-[var(--hos-ink-2)] no-underline"
          >
            Agents
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2 text-center">
          <div className="text-[9px] uppercase text-[var(--hos-ink-3)]">Revenue</div>
          <div className="font-mono text-sm font-bold tabular-nums">{formatNu(row.revenue)}</div>
        </div>
        <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2 text-center">
          <div className="text-[9px] uppercase text-[var(--hos-ink-3)]">Paid</div>
          <div className="font-mono text-sm font-bold tabular-nums text-[var(--hos-emerald)]">
            {formatNu(row.paid)}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2 text-center">
          <div className="text-[9px] uppercase text-[var(--hos-ink-3)]">Unpaid</div>
          <div className="font-mono text-sm font-bold tabular-nums text-[var(--hos-ruby)]">
            {formatNu(row.unpaid)}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2 text-center">
          <div className="text-[9px] uppercase text-[var(--hos-ink-3)]">90d outlook</div>
          <div className="font-mono text-sm font-bold tabular-nums">
            {row.outlook.projectedNights90d}n
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
            Nationality
          </div>
          <MixChips rows={row.nationalityMix} empty="No nationality on stays" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
            Meal / room
          </div>
          <MixChips rows={row.mealMix} empty="—" />
          <div className="mt-1">
            <MixChips rows={row.roomMix} empty="—" />
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-surface)] p-2.5 text-[11px] text-[var(--hos-ink-2)]">
        <strong className="text-[var(--hos-ink)]">Outlook</strong> ·{" "}
        {row.outlook.confidence} confidence
        {row.outlook.nextLikelyArrival
          ? ` · next ~${row.outlook.nextLikelyArrival}`
          : ""}
        <div className="mt-0.5 text-[var(--hos-ink-3)]">{row.outlook.rationale}</div>
        <div className="mt-2">
          <strong className="text-[var(--hos-ink)]">Offer</strong> · {row.cues.rateNote}
        </div>
        {row.cues.menuCues.length > 0 ? (
          <ul className="m-0 mt-1 list-disc pl-4 text-[var(--hos-ink-3)]">
            {row.cues.menuCues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        {row.cues.amenities.length > 0 ? (
          <div className="mt-1 text-[var(--hos-ink-3)]">
            Amenities / notes: {row.cues.amenities.join(" · ")}
          </div>
        ) : null}
      </div>
    </GlassPanel>
  );
}

function GuestDossierCard({ row }: { row: GuestIntelligenceRow }) {
  return (
    <GlassPanel className="p-3.5" data-testid={`intel-guest-${row.guestKey}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <strong className="text-sm text-[var(--hos-ink)]">{row.guestName}</strong>
          <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
            {row.nationality} · {row.passportOrCid} · {row.visits} visits ·{" "}
            {row.roomNights}n · {formatNu(row.spend)}
          </p>
        </div>
        <Link
          to="/guests"
          className="inline-flex min-h-9 items-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 text-[12px] font-semibold text-[var(--hos-ink-2)] no-underline"
        >
          Guests CRM
        </Link>
      </div>
      {row.agents.length > 0 ? (
        <p className="m-0 mt-2 text-[11px] text-[var(--hos-ink-3)]">
          Via {row.agents.join(", ")}
        </p>
      ) : null}
      <div className="mt-2">
        <MixChips rows={row.mealMix} empty="No meal history" />
      </div>
      <div className="mt-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-surface)] p-2.5 text-[11px]">
        <strong>Outlook</strong> · {row.outlook.rationale}
        <div className="mt-1 text-[var(--hos-ink-3)]">{row.cues.rateNote}</div>
        {row.cues.menuCues.map((c) => (
          <div key={c} className="text-[var(--hos-ink-3)]">
            · {c}
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

export function IntelligenceHub({
  initialTab,
}: {
  initialTab?: IntelTab;
}) {
  const [params] = useSearchParams();
  const tabParam = (params.get("intel") as IntelTab | null) ?? initialTab ?? "agents";
  const [tab, setTab] = useState<IntelTab>(
    tabParam === "guests" || tabParam === "ops" || tabParam === "agents"
      ? tabParam
      : "agents",
  );

  useEffect(() => {
    if (tabParam === "guests" || tabParam === "ops" || tabParam === "agents") {
      setTab(tabParam);
    }
  }, [tabParam]);

  const period0 = defaultPeriod();
  const [from, setFrom] = useState(period0.from);
  const [to, setTo] = useState(period0.to);

  const agents = useCommercialStore((s) => s.agents);
  const cells = useCommercialStore((s) => s.cells);
  const season = useCommercialStore((s) => s.season);
  const stays = useFrontOfficeStore((s) => s.stays);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const fiscalDocs = useExtrasStore((s) => s.fiscalDocs);
  const hrStaff = useEnterpriseOpsStore((s) => s.hrStaff);
  const punches = useEnterpriseOpsStore((s) => s.punches);

  const [printAgentId, setPrintAgentId] = useState<string | null>(null);
  const printAgent = agents.find((a) => a.id === printAgentId) ?? null;

  const agentReport = useMemo(
    () =>
      buildAgentIntelligence({
        agents,
        stays,
        from,
        to,
        cells,
        season,
        topN: 10,
      }),
    [agents, stays, from, to, cells, season],
  );

  const guestReport = useMemo(
    () => buildGuestIntelligence({ stays, from, to }),
    [stays, from, to],
  );

  const payrollNet = useMemo(() => {
    const ym = to.slice(0, 7);
    const sheet = buildSalarySheet({
      staff: hrStaff,
      punches,
      periodYm: ym,
      advances: [],
      tipShares: new Map(),
    });
    const net = sheet.reduce((n, r) => n + r.netPayBtn, 0);
    return net > 0 ? net : null;
  }, [hrStaff, punches, to]);

  const opsReport = useMemo(
    () =>
      buildOpsHrIntelligence({
        stays,
        roomsCount: rooms.filter((r) => r.hkStatus !== "ooo").length || rooms.length,
        from,
        to,
        staff: hrStaff,
        payrollNetMonthly: payrollNet,
      }),
    [stays, rooms, from, to, hrStaff, payrollNet],
  );

  const downloadAgents = () => {
    const table = exportAgentIntelligenceCsv(agentReport.all);
    const r = exportCsv(
      `agent-intelligence-${from}_${to}.csv`,
      table[0]!,
      table.slice(1),
    );
    toast.success(`Exported ${r.rows} agent rows`, { description: r.filename });
  };

  const downloadGuests = () => {
    const rows = [...guestReport.dossiers, ...guestReport.needMoreData];
    const table = exportGuestIntelligenceCsv(rows);
    const r = exportCsv(
      `guest-intelligence-${from}_${to}.csv`,
      table[0]!,
      table.slice(1),
    );
    toast.success(`Exported ${r.rows} guest rows`, { description: r.filename });
  };

  const printSection = () => {
    window.print();
    toast.success("Print dialog opened");
  };

  return (
    <div className="flex flex-col gap-4" data-testid="intelligence-hub">
      <GlassPanel className="p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <strong className="flex items-center gap-1.5 text-sm text-[var(--hos-ink)]">
              <Sparkles className="size-4 text-[var(--hos-brass)]" />
              Intelligence
            </strong>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
              Top agents · guest dossiers · season staffing — rule-based outlook, not ML
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] font-semibold text-[var(--hos-ink-3)]">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-1.5 py-1 text-xs"
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] font-semibold text-[var(--hos-ink-3)]">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-1.5 py-1 text-xs"
              />
            </label>
            <Button size="sm" variant="ghost" onClick={printSection}>
              <Printer className="size-3.5" />
              Print
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              ["agents", "Agents", agentReport.top.length],
              ["guests", "Guests", guestReport.dossiers.length],
              ["ops", "Ops & HR", opsReport.headcountActive],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              data-testid={`intel-tab-${id}`}
              onClick={() => setTab(id)}
              className={[
                "hos-btn-tactile inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition",
                tab === id
                  ? "bg-[#111] text-white"
                  : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]",
              ].join(" ")}
            >
              {label}
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                {count}
              </span>
            </button>
          ))}
        </div>
      </GlassPanel>

      {tab === "agents" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
              Top {agentReport.top.length} by room-nights · {agentReport.all.length}{" "}
              operators with production in period
            </p>
            <Button size="sm" variant="secondary" onClick={downloadAgents}>
              <Download className="size-3.5" />
              CSV
            </Button>
          </div>
          {agentReport.top.length === 0 ? (
            <EmptyState
              title="No agent production"
              description="No agent-linked stays in this period."
            />
          ) : (
            agentReport.top.map((row, i) => (
              <AgentDossierCard
                key={row.agentId}
                row={row}
                rank={i + 1}
                onPrintPack={() => setPrintAgentId(row.agentId)}
              />
            ))
          )}
        </div>
      ) : null}

      {tab === "guests" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
              Min data: 2 checked-out stays, or 1 stay + passport + nationality ·{" "}
              {guestReport.dossiers.length} ready · {guestReport.needMoreData.length}{" "}
              need more data
            </p>
            <Button size="sm" variant="secondary" onClick={downloadGuests}>
              <Download className="size-3.5" />
              CSV
            </Button>
          </div>
          {guestReport.dossiers.length === 0 ? (
            <EmptyState
              title="No guest dossiers yet"
              description="Guests need more stays or ID + nationality on file."
            />
          ) : (
            guestReport.dossiers.map((row) => (
              <GuestDossierCard key={row.guestKey} row={row} />
            ))
          )}
          {guestReport.needMoreData.length > 0 ? (
            <GlassPanel className="p-3.5">
              <strong className="text-xs uppercase tracking-wide text-[var(--hos-ink-3)]">
                Need more data
              </strong>
              <ul className="m-0 mt-2 list-none space-y-2 p-0">
                {guestReport.needMoreData.slice(0, 20).map((row) => (
                  <li
                    key={row.guestKey}
                    className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-[12px]"
                  >
                    <strong>{row.guestName}</strong>
                    <span className="text-[var(--hos-ink-3)]">
                      {" "}
                      · {row.visits} stay(s) · missing{" "}
                      {!row.gate.ok ? row.gate.missing.join(", ") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          ) : null}
        </div>
      ) : null}

      {tab === "ops" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Occupancy" value={`${opsReport.occPct}%`} delta="Period" />
            <KpiCard label="ADR" value={formatNu(opsReport.adr)} delta="Sold nights" />
            <KpiCard
              label="Sell capacity"
              value={formatNu(opsReport.sellPotential)}
              delta={`${opsReport.roomNightsCapacity} RN cap`}
            />
            <KpiCard
              label="Room cost est."
              value={formatNu(opsReport.estimatedRoomCost)}
              delta={`Nu ${opsReport.roomNightCostBtn}/n`}
            />
          </div>

          <GlassPanel className="p-3.5">
            <strong className="text-sm">Cost vs sell</strong>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 text-[12px]">
              <div>
                Payroll (month){" "}
                <strong className="tabular-nums">
                  {opsReport.payrollNetMonthly != null
                    ? formatNu(opsReport.payrollNetMonthly)
                    : "—"}
                </strong>
              </div>
              <div>
                Total cost glance{" "}
                <strong className="tabular-nums">
                  {opsReport.totalCostGlance != null
                    ? formatNu(opsReport.totalCostGlance)
                    : "—"}
                </strong>
              </div>
              <div>
                Margin glance{" "}
                <strong className="tabular-nums">
                  {opsReport.marginGlance != null
                    ? formatNu(opsReport.marginGlance)
                    : "—"}
                </strong>
              </div>
            </div>
            <ul className="m-0 mt-2 list-disc pl-4 text-[11px] text-[var(--hos-ink-3)]">
              {opsReport.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel className="p-3.5">
            <strong className="text-sm">
              Staffing · peak {opsReport.peakOccPct}% / lean {opsReport.leanOccPct}%
            </strong>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
              Active headcount {opsReport.headcountActive} · recommendations from occ ×
              labor ratios
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--hos-line)]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hos-line)] bg-[var(--hos-surface)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                    <th className="px-3 py-2">Dept</th>
                    <th className="px-3 py-2 text-right">Active</th>
                    <th className="px-3 py-2 text-right">Peak need</th>
                    <th className="px-3 py-2 text-right">Lean need</th>
                  </tr>
                </thead>
                <tbody>
                  {opsReport.byDept.map((d) => (
                    <tr key={d.dept} className="border-b border-[var(--hos-line)]">
                      <td className="px-3 py-2 font-semibold">{d.dept}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {d.active}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {d.recommendedPeak}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {d.recommendedLean}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassPanel>

          <GlassPanel className="p-3.5">
            <strong className="text-sm">Season calendar</strong>
            {opsReport.months.length === 0 ? (
              <EmptyState
                title="No month buckets"
                description="No stays in period for season chart."
              />
            ) : (
              <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--hos-line)]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hos-line)] bg-[var(--hos-surface)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2 text-right">RN</th>
                      <th className="px-3 py-2 text-right">Occ</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                      <th className="px-3 py-2 text-right">FO</th>
                      <th className="px-3 py-2 text-right">HK</th>
                      <th className="px-3 py-2 text-right">F&B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opsReport.months.map((m) => (
                      <tr key={m.key} className="border-b border-[var(--hos-line)]">
                        <td className="px-3 py-2 font-semibold">{m.label}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {m.roomNightsSold}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {m.occPct}%
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {money(m.revenue)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {m.suggestedFo}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {m.suggestedHk}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {m.suggestedFnb}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassPanel>
        </div>
      ) : null}

      <AgentPrintPackOverlay
        open={Boolean(printAgent)}
        agent={printAgent}
        stays={stays}
        fiscalDocs={fiscalDocs}
        onClose={() => setPrintAgentId(null)}
      />
    </div>
  );
}
