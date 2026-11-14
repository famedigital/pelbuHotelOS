import { Drawer } from "vaul";
import { FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  GlassTiltCard,
  KpiCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import {
  rateCardById,
  useCommercialStore,
  type Agent,
} from "../lib/commercial-store";
import { buildPartneredAgentRows, type PartneredAgentRow } from "../lib/b2b-portfolio";
import { DEMO_MOU_PROPERTY_ID, useMouStore } from "../lib/mou-store";
import { usePartnerPortalStore } from "../lib/partner-portal-store";
import { useExtrasStore } from "../lib/extras-store";
import { formatNu, useFrontOfficeStore, type Stay } from "../lib/front-office-store";
import {
  agentHasBookings,
  agentRowsToCsv,
  filterAgentRows,
  type AgentListFilter,
  type AgentListSegment,
  type AgentListSort,
} from "../lib/agent-list";
import { escapePrintHtml, printHtmlDocument } from "../lib/print-html";
import { PaidUnpaidBar } from "./PaidUnpaidBar";
import { AgentPrintPackOverlay } from "./AgentPrintPackOverlay";

type DossierTab = "bookings" | "unpaid" | "statement" | "more";

function stayMatchesAgent(stay: Stay, agent: Agent): boolean {
  if (stay.source !== "agent" && !stay.agencyName) return false;
  const token = agent.name.split(" ")[0]?.toLowerCase() ?? "";
  const hay = (stay.agencyName ?? "").toLowerCase();
  return (
    hay.includes(token) ||
    token.includes(hay.split(" ")[0] ?? "") ||
    (stay.agencyName?.includes(agent.code) ?? false)
  );
}

export function AgentsPage() {
  const [params, setParams] = useSearchParams();
  const agents = useCommercialStore((s) => s.agents);
  const cells = useCommercialStore((s) => s.cells);
  const rateCards = useCommercialStore((s) => s.rateCards);
  const season = useCommercialStore((s) => s.season);
  const mealPlan = useCommercialStore((s) => s.mealPlan);
  const recordPayment = useCommercialStore((s) => s.recordPayment);
  const allocateWireBatch = useCommercialStore((s) => s.allocateWireBatch);
  const changeRequests = usePartnerPortalStore((s) => s.changeRequests);
  const deskReviewChange = usePartnerPortalStore((s) => s.deskReviewChange);
  const depositSlips = usePartnerPortalStore((s) => s.depositSlips);
  const verifyDeposit = usePartnerPortalStore((s) => s.verifyDeposit);
  const mouLinks = useMouStore((s) => s.links);
  const fiscalDocs = useExtrasStore((s) => s.fiscalDocs);
  const stays = useFrontOfficeStore((s) => s.stays);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const openStay = useFrontOfficeStore((s) => s.openStay);

  const [segment, setSegment] = useState<AgentListSegment>("with_bookings");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AgentListFilter>("all");
  const [sort, setSort] = useState<AgentListSort>("unpaid");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dossierTab, setDossierTab] = useState<DossierTab>("bookings");
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementAgentId, setStatementAgentId] = useState<string | null>(null);
  const [wireAmt, setWireAmt] = useState(50000);
  const [wireRef, setWireRef] = useState("");
  const [payAmt, setPayAmt] = useState(25000);

  const bd = businessDate || new Date().toISOString().slice(0, 10);

  const depositAwaitingByAgent = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of depositSlips) {
      if (d.status !== "awaiting_desk") continue;
      map[d.agentId] = (map[d.agentId] ?? 0) + 1;
    }
    return map;
  }, [depositSlips]);

  const partneredRows = useMemo(
    () =>
      buildPartneredAgentRows({
        agents,
        links: mouLinks,
        rateCards,
        cells,
        season,
        mealPlan,
        stays,
        fiscalDocs,
        depositAwaitingByAgent,
        businessDate: bd,
        propertyId: DEMO_MOU_PROPERTY_ID,
      }),
    [
      agents,
      mouLinks,
      rateCards,
      cells,
      season,
      mealPlan,
      stays,
      fiscalDocs,
      depositAwaitingByAgent,
      bd,
    ],
  );

  useEffect(() => {
    const f = params.get("filter");
    if (f === "unpaid" || f === "overdue" || f === "active") setFilter(f);
    const agentQ = params.get("agent");
    if (agentQ) {
      setQuery(agentQ);
      setSegment("with_bookings");
      const hit =
        partneredRows.find(
          (r) =>
            r.code.toLowerCase() === agentQ.toLowerCase() ||
            r.name.toLowerCase().includes(agentQ.toLowerCase()),
        ) ?? null;
      if (hit) {
        setSelectedId(hit.agentId);
        if (params.get("print") === "1") {
          setStatementAgentId(hit.agentId);
          setStatementOpen(true);
        } else {
          setDrawerOpen(true);
          setDossierTab("unpaid");
        }
      }
    }
    if (params.get("print") === "1" && !agentQ) {
      /* Cmd+K lands here — open print for first unpaid booker when possible */
      const first = partneredRows.find((r) => agentHasBookings(r) && r.arOutstanding > 0);
      if (first) {
        setStatementAgentId(first.agentId);
        setStatementOpen(true);
      }
    }
  }, [params, partneredRows]);

  const directory = useMemo(
    () =>
      filterAgentRows({
        rows: partneredRows,
        segment,
        query,
        filter,
        sort,
      }),
    [partneredRows, segment, query, filter, sort],
  );

  const bookedPool = useMemo(
    () => partneredRows.filter(agentHasBookings),
    [partneredRows],
  );
  const kpiUnpaid = bookedPool.reduce((n, r) => n + r.arOutstanding, 0);
  const kpiOverdue = bookedPool.reduce((n, r) => n + r.aging90, 0);
  const followUps = useMemo(
    () =>
      bookedPool
        .filter((r) => r.arOutstanding > 0.5 || r.aging90 > 0.5)
        .sort((a, b) => b.arOutstanding - a.arOutstanding)
        .slice(0, 8),
    [bookedPool],
  );

  const selectedAgent =
    agents.find((a) => a.id === selectedId) ??
    agents.find((a) => a.id === directory[0]?.agentId) ??
    null;
  const selectedRow =
    partneredRows.find((r) => r.agentId === selectedAgent?.id) ?? null;

  const agentStays = useMemo(() => {
    if (!selectedAgent) return [];
    return stays
      .filter((s) => stayMatchesAgent(s, selectedAgent))
      .filter((s) => {
        if (!fromDate && !toDate) return true;
        const from = fromDate || "0000-01-01";
        const to = toDate || "9999-12-31";
        return s.checkIn <= to && s.checkOut >= from;
      })
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  }, [stays, selectedAgent, fromDate, toDate]);

  const statementAgent =
    agents.find((a) => a.id === statementAgentId) ?? selectedAgent;

  const openDossier = (agentId: string, tab: DossierTab = "bookings") => {
    setSelectedId(agentId);
    setDossierTab(tab);
    setDrawerOpen(true);
  };

  const openStatement = (agentId: string) => {
    setSelectedId(agentId);
    setStatementAgentId(agentId);
    setStatementOpen(true);
  };

  const clearFilters = () => {
    setQuery("");
    setFilter("all");
    setSort("unpaid");
    setFromDate("");
    setToDate("");
    setParams({}, { replace: true });
  };

  const exportCsv = () => {
    if (directory.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const csv = agentRowsToCsv(directory);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agents-${segment}-${bd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${directory.length} agents`);
  };

  const printList = () => {
    if (directory.length === 0) {
      toast.error("Nothing to print");
      return;
    }
    try {
      const rows = directory
        .map(
          (r) => `<tr>
          <td>${escapePrintHtml(r.name)}</td>
          <td>${escapePrintHtml(r.code)}</td>
          <td style="text-align:right">${r.arOutstanding.toFixed(2)}</td>
          <td style="text-align:right">${r.paidTotal.toFixed(2)}</td>
          <td style="text-align:right">${r.staysInHouse}</td>
          <td style="text-align:right">${r.staysArriving}</td>
          <td style="text-align:right">${r.staysHeld}</td>
          <td style="text-align:right">${r.aging90.toFixed(2)}</td>
        </tr>`,
        )
        .join("");
      printHtmlDocument(
        `<!doctype html><html><head><title>Agents</title>
<style>
  body{font-family:Georgia,serif;padding:24px;color:#111}
  h1{font-size:20px;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #ccc;padding:6px 8px}
  th{background:#f4f4f4;text-align:left}
</style></head><body>
<h1>Agents · ${escapePrintHtml(segment === "with_bookings" ? "With bookings" : "Directory")}</h1>
<p>${directory.length} agents · Unpaid Nu ${kpiUnpaid.toFixed(2)}</p>
<table>
<thead><tr><th>Agent</th><th>Code</th><th>Unpaid</th><th>Paid</th><th>IH</th><th>Arr</th><th>Held</th><th>Overdue</th></tr></thead>
<tbody>${rows}</tbody>
</table></body></html>`,
        "Agents",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    }
  };

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[11px] font-bold ${
      active
        ? "border-[rgba(37,99,235,0.45)] bg-[rgba(37,99,235,0.12)] text-[var(--hos-primary)]"
        : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
    }`;

  const renderRow = (row: PartneredAgentRow) => {
    const booked = agentHasBookings(row);
    return (
      <tr key={row.agentId} className="group hover:bg-[rgba(37,99,235,0.04)]">
        <td className="px-3 py-2.5">
          <button
            type="button"
            className="flex flex-col text-left"
            onClick={() => openDossier(row.agentId)}
          >
            <span className="font-semibold text-[var(--hos-ink)]">{row.name}</span>
            <span className="flex items-center gap-1.5">
              <Badge tone="teal">{row.code}</Badge>
              {row.creditHold ? <Badge tone="danger">Hold</Badge> : null}
              {!booked ? <Badge tone="muted">No bookings yet</Badge> : null}
            </span>
          </button>
        </td>
        <td
          className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${
            row.arOutstanding > 0 ? "text-[var(--hos-ruby)]" : "text-[var(--hos-ink)]"
          }`}
        >
          {formatNu(row.arOutstanding)}
        </td>
        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--hos-ink-2)]">
          {formatNu(row.paidTotal)}
        </td>
        <td className="px-3 py-2.5 min-w-[110px]">
          <PaidUnpaidBar
            paid={row.paidTotal}
            unpaid={row.arOutstanding}
            showLabels={false}
          />
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">{row.staysInHouse}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{row.staysArriving}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{row.staysHeld}</td>
        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--hos-ink-2)]">
          {row.aging90 > 0 ? formatNu(row.aging90) : "—"}
        </td>
        <td className="px-3 py-2.5 text-right">
          <Button size="sm" variant="secondary" onClick={() => openStatement(row.agentId)}>
            <FileText className="size-3.5" aria-hidden />
            Print
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <ModuleFrame
      title="Agents"
      description="Who books with us · what they owe · print statement"
      eyebrow="Reservation · B2B"
      actions={
        <>
          <StatusLegend
            dense
            className="hidden lg:flex"
            items={[
              { id: "ok", label: "Settled", swatch: "var(--hos-emerald)" },
              { id: "due", label: "Unpaid", swatch: "var(--hos-ruby)" },
              { id: "over", label: "Overdue", swatch: "var(--hos-brass)" },
            ]}
          />
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={printList}>
            Print list
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/reservations">Reservations</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/finance">Finance</Link>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Agents with bookings"
            value={bookedPool.length}
            delta={`${partneredRows.length - bookedPool.length} in directory`}
          />
          <KpiCard label="Unpaid total" value={formatNu(kpiUnpaid)} delta="Open AR" />
          <KpiCard
            label="Overdue"
            value={formatNu(kpiOverdue)}
            delta={kpiOverdue > 0 ? "90d+ bucket" : "Clear"}
          />
        </div>

        <GlassPanel className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="text-[10px] font-bold uppercase tracking-wider text-[var(--hos-ink-3)]">
              Needs follow-up
            </strong>
            <button
              type="button"
              className="text-[11px] font-bold text-[var(--hos-primary)]"
              onClick={() => {
                setSegment("with_bookings");
                setFilter("unpaid");
              }}
            >
              Show unpaid
            </button>
          </div>
          {followUps.length === 0 ? (
            <p className="m-0 text-xs text-[var(--hos-ink-3)]">
              No unpaid agents with bookings — nice.
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {followUps.map((r) => (
                <button
                  key={r.agentId}
                  type="button"
                  onClick={() => openDossier(r.agentId, "unpaid")}
                  className="shrink-0 rounded-xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.06)] px-3 py-2 text-left"
                >
                  <div className="text-[11px] font-bold text-[var(--hos-ink)]">{r.name}</div>
                  <div className="font-mono text-[10px] text-[var(--hos-ruby)]">
                    Nu. {Math.round(r.arOutstanding).toLocaleString("en-BT")} unpaid
                  </div>
                </button>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassTiltCard className="flex flex-col gap-3 p-3.5" glowColor="brand">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chip(segment === "with_bookings")}
              onClick={() => setSegment("with_bookings")}
            >
              With bookings
            </button>
            <button
              type="button"
              className={chip(segment === "directory")}
              onClick={() => setSegment("directory")}
            >
              Directory
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hos-search-field min-w-[160px] flex-1">
              <Search className="hos-search-icon" strokeWidth={1.75} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or code…"
                className="hos-search-input w-full rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] py-2 text-xs outline-none focus:border-[var(--hos-primary)]"
              />
            </div>
            {(
              [
                ["all", "All"],
                ["unpaid", "Unpaid"],
                ["overdue", "Overdue"],
                ["active", "Active"],
                ["in_house", "In-house"],
                ["arriving", "Arriving"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(filter === id)}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as AgentListSort)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-[11px] font-semibold"
            >
              <option value="unpaid">Sort: Unpaid</option>
              <option value="name">Sort: Name</option>
              <option value="paid">Sort: Paid</option>
              <option value="in_house">Sort: In-house</option>
              <option value="arriving">Sort: Arriving</option>
              <option value="code">Sort: Code</option>
            </select>
            <label className="text-[10px] font-semibold uppercase text-[var(--hos-ink-3)]">
              From
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 block rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-[10px] font-semibold uppercase text-[var(--hos-ink-3)]">
              To
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 block rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              />
            </label>
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              Clear
            </Button>
          </div>

          <p className="m-0 text-[12px] font-semibold text-[var(--hos-ink-2)]">
            {directory.length} agents · Nu.{" "}
            {Math.round(
              directory.reduce((n, r) => n + r.arOutstanding, 0),
            ).toLocaleString("en-BT")}{" "}
            unpaid
          </p>

          {agents.length === 0 ? (
            <EmptyState
              title="No agents yet"
              description="Onboard a B2B agent in Super Admin."
              action={
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/superadmin">Super Admin</Link>
                </Button>
              }
            />
          ) : directory.length === 0 ? (
            <EmptyState
              title={
                segment === "with_bookings"
                  ? "No agent bookings yet"
                  : "Directory is empty"
              }
              description={
                segment === "with_bookings"
                  ? "Open Directory for partners without stays, or create a reservation."
                  : "Every partner currently has bookings — switch to With bookings."
              }
              action={
                <div className="flex flex-wrap gap-2">
                  {segment === "with_bookings" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSegment("directory")}
                    >
                      Open Directory
                    </Button>
                  ) : null}
                  <Button size="sm" variant="secondary" asChild>
                    <Link to="/reservations">Reservations</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <ul className="m-0 grid list-none gap-2 p-0 md:hidden">
                {directory.map((row) => (
                  <li key={row.agentId}>
                    <div className="hos-cell flex flex-col gap-2 rounded-xl border border-[var(--hos-line)] p-3">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => openDossier(row.agentId)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <strong className="text-[13px] text-[var(--hos-ink)]">
                            {row.name}
                          </strong>
                          <Badge tone="teal">{row.code}</Badge>
                        </div>
                        <div className="mt-1 flex justify-between font-mono text-[12px]">
                          <span className="text-[var(--hos-ink-3)]">Unpaid</span>
                          <span className="font-semibold text-[var(--hos-ruby)]">
                            {formatNu(row.arOutstanding)}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--hos-ink-3)]">
                          IH {row.staysInHouse} · Arr {row.staysArriving} · Held{" "}
                          {row.staysHeld}
                        </div>
                        <PaidUnpaidBar
                          paid={row.paidTotal}
                          unpaid={row.arOutstanding}
                          showLabels={false}
                        />
                      </button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openStatement(row.agentId)}
                      >
                        Print statement
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] md:block">
                <table
                  className="w-full min-w-[920px] text-left text-xs"
                  data-testid="agents-partnered-directory"
                >
                  <thead className="sticky top-0 z-[1] bg-[var(--hos-cell)]">
                    <tr className="border-b border-[var(--hos-line)] text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                      <th className="px-3 py-2">Agent</th>
                      <th className="px-3 py-2 text-right">Unpaid</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2">Bar</th>
                      <th className="px-3 py-2 text-right">In-house</th>
                      <th className="px-3 py-2 text-right">Arriving</th>
                      <th className="px-3 py-2 text-right">Held</th>
                      <th className="px-3 py-2 text-right">Overdue</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)]">
                    {directory.map(renderRow)}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </GlassTiltCard>
      </div>

      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Drawer.Content className="fixed bottom-0 right-0 z-50 flex h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--hos-line)] bg-[var(--hos-surface)] shadow-2xl outline-none md:rounded-l-2xl md:rounded-tr-none">
            <div className="border-b border-[var(--hos-line)] px-4 py-3">
              <Drawer.Title className="m-0 text-[15px] font-bold text-[var(--hos-ink)]">
                {selectedAgent?.name ?? "Agent"}
              </Drawer.Title>
              <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                {selectedAgent?.code} · {selectedRow?.rateCardCode ?? "—"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(
                  [
                    ["bookings", "Bookings"],
                    ["unpaid", "Unpaid"],
                    ["statement", "Statement"],
                    ["more", "More"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={chip(dossierTab === id)}
                    onClick={() => setDossierTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!selectedAgent || !selectedRow ? (
                <p className="text-sm text-[var(--hos-ink-3)]">Select an agent.</p>
              ) : dossierTab === "bookings" ? (
                <div className="flex flex-col gap-2">
                  {agentStays.length === 0 ? (
                    <EmptyState
                      title="No stays"
                      description="No bookings match this agent in the date range."
                    />
                  ) : (
                    agentStays.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="hos-cell rounded-xl border border-[var(--hos-line)] p-3 text-left"
                        onClick={() => openStay(s.id)}
                      >
                        <div className="font-semibold text-[var(--hos-ink)]">
                          {s.guestName}
                        </div>
                        <div className="text-[11px] text-[var(--hos-ink-3)]">
                          {s.confirmationNo} · {s.checkIn} → {s.checkOut} ·{" "}
                          {s.status.replace("_", " ")}
                        </div>
                      </button>
                    ))
                  )}
                  <Button size="sm" variant="secondary" asChild>
                    <Link to="/reservations">Open Reservations</Link>
                  </Button>
                </div>
              ) : dossierTab === "unpaid" ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-4">
                    <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
                      Unpaid
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-[var(--hos-ruby)]">
                      {formatNu(selectedRow.arOutstanding)}
                    </div>
                    <div className="mt-2 text-[12px] text-[var(--hos-ink-2)]">
                      Paid {formatNu(selectedRow.paidTotal)} · Credit limit{" "}
                      {formatNu(selectedRow.creditLimit)}
                    </div>
                    <PaidUnpaidBar
                      paid={selectedRow.paidTotal}
                      unpaid={selectedRow.arOutstanding}
                      className="mt-3"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-lg border border-[var(--hos-line)] p-2">
                      Current / aging
                      <div className="font-mono font-semibold">
                        {formatNu(selectedAgent.aging.current)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--hos-line)] p-2">
                      30 days
                      <div className="font-mono font-semibold">
                        {formatNu(selectedAgent.aging.d30)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--hos-line)] p-2">
                      60 days
                      <div className="font-mono font-semibold">
                        {formatNu(selectedAgent.aging.d60)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--hos-line)] p-2">
                      90+ days
                      <div className="font-mono font-semibold text-[var(--hos-ruby)]">
                        {formatNu(selectedAgent.aging.d90)}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openStatement(selectedAgent.id)}
                  >
                    Print statement
                  </Button>
                </div>
              ) : dossierTab === "statement" ? (
                <div className="flex flex-col gap-3">
                  <p className="m-0 text-[13px] text-[var(--hos-ink-2)]">
                    Print pack builds the client statement (unpaid / full archive). Date
                    range on the list toolbar scopes the dossier bookings tab.
                  </p>
                  <Button size="sm" onClick={() => openStatement(selectedAgent.id)}>
                    Open print pack
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const csv = agentRowsToCsv([selectedRow]);
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${selectedAgent.code}-summary.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success("Exported agent summary");
                    }}
                  >
                    Export agent CSV
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 text-[13px]">
                  <div className="rounded-xl border border-[var(--hos-line)] p-3">
                    <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
                      MoU / rate
                    </div>
                    <div className="mt-1 font-semibold text-[var(--hos-ink)]">
                      {selectedRow.mouStatus} · {selectedRow.rateCardCode}
                    </div>
                    <div className="text-[12px] text-[var(--hos-ink-3)]">
                      Dbl net{" "}
                      {selectedRow.doubleNet != null
                        ? formatNu(selectedRow.doubleNet)
                        : "—"}
                    </div>
                    <Button size="sm" variant="ghost" className="mt-2" asChild>
                      <Link to="/rates">Open Rates</Link>
                    </Button>
                  </div>
                  <div className="rounded-xl border border-[var(--hos-line)] p-3">
                    <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
                      Record payment
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        value={payAmt}
                        onChange={(e) => setPayAmt(Number(e.target.value) || 0)}
                        className="w-28 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          void recordPayment(selectedAgent.id, payAmt).then((res) => {
                            if (!res.ok) toast.error(res.error);
                            else toast.success(`Recorded ${formatNu(payAmt)}`);
                          });
                        }}
                      >
                        Post
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--hos-line)] p-3">
                    <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
                      Batch wire (accountant)
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        type="number"
                        value={wireAmt}
                        onChange={(e) => setWireAmt(Number(e.target.value) || 0)}
                        className="w-28 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
                      />
                      <input
                        value={wireRef}
                        onChange={(e) => setWireRef(e.target.value)}
                        placeholder="Bank ref"
                        className="min-w-[120px] flex-1 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const res = allocateWireBatch([selectedAgent.id], wireAmt);
                          if (!res.ok) toast.error(res.error);
                          else
                            toast.success(`Wire ${formatNu(res.applied)}`, {
                              description: wireRef || undefined,
                            });
                        }}
                      >
                        Apply wire
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--hos-line)] p-3">
                    <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
                      Partner change requests
                    </div>
                    {changeRequests.filter(
                      (c) => c.agentId === selectedAgent.id && c.status === "pending",
                    ).length === 0 ? (
                      <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">None</p>
                    ) : (
                      changeRequests
                        .filter(
                          (c) =>
                            c.agentId === selectedAgent.id && c.status === "pending",
                        )
                        .map((c) => (
                          <div
                            key={c.id}
                            className="mt-2 flex items-center justify-between gap-2"
                          >
                            <span className="text-[12px]">{c.summary ?? c.kind}</span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                void deskReviewChange(c.id, "approved").then((res) => {
                                  if (!res.ok) toast.error(res.error);
                                  else toast.success("Change approved");
                                });
                              }}
                            >
                              Approve
                            </Button>
                          </div>
                        ))
                    )}
                  </div>
                  <div className="rounded-xl border border-[var(--hos-line)] p-3">
                    <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
                      Deposit proofs
                    </div>
                    {depositSlips.filter(
                      (d) =>
                        d.agentId === selectedAgent.id && d.status === "awaiting_desk",
                    ).length === 0 ? (
                      <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">None</p>
                    ) : (
                      depositSlips
                        .filter(
                          (d) =>
                            d.agentId === selectedAgent.id &&
                            d.status === "awaiting_desk",
                        )
                        .map((d) => (
                          <div
                            key={d.id}
                            className="mt-2 flex items-center justify-between gap-2"
                          >
                            <span className="text-[12px]">
                              {formatNu(d.amount)} · {d.ref ?? "slip"}
                            </span>
                            <Button
                              size="sm"
                              onClick={() => {
                                void verifyDeposit(d.id, "verified", selectedAgent.id).then(
                                  (res) => {
                                    if (!res.ok) toast.error(res.error);
                                    else toast.success("Deposit verified");
                                  },
                                );
                              }}
                            >
                              Verify
                            </Button>
                          </div>
                        ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/partner">Partner portal</Link>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/finance">Finance hub</Link>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/reports?intel=agents`}>Insights</Link>
                    </Button>
                  </div>
                  <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                    Card: {rateCardById(rateCards, selectedAgent.rateCardId)?.code ?? "—"}
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-[var(--hos-line)] p-3">
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => selectedAgent && openStatement(selectedAgent.id)}
                disabled={!selectedAgent}
              >
                Print statement
              </Button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <AgentPrintPackOverlay
        open={statementOpen}
        agent={statementAgent}
        stays={stays}
        fiscalDocs={fiscalDocs}
        onClose={() => {
          setStatementOpen(false);
          setStatementAgentId(null);
        }}
      />
    </ModuleFrame>
  );
}
