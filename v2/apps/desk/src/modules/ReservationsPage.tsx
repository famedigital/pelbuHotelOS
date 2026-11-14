import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  KpiCard,
  ModuleFrame,
  MorphTabs,
  StatusLegend,
} from "@hos-v2/ui";
import {
  formatNu,
  folioBalance,
  folioTotals,
  useFrontOfficeStore,
  type BookingStatus,
  type Stay,
} from "../lib/front-office-store";
import { runCommand } from "../lib/api";
import { buildPartneredAgentRows } from "../lib/b2b-portfolio";
import { useCommercialStore } from "../lib/commercial-store";
import { DEMO_MOU_PROPERTY_ID, useMouStore } from "../lib/mou-store";
import { useExtrasStore } from "../lib/extras-store";
import { usePartnerPortalStore } from "../lib/partner-portal-store";
import { escapePrintHtml, printHtmlDocument } from "../lib/print-html";
import {
  agencyOptions,
  countFollowUp,
  filterReservations,
  isCheckoutUnpaid,
  isUnassignedLive,
  reservationsToCsv,
  sumUnpaidNow,
  type ResMoneyChip,
  type ResSortKey,
  type ResStatusTab,
} from "../lib/reservations-list";
import { PaidUnpaidBar } from "./PaidUnpaidBar";

const FILTERS: { id: ResStatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "confirmed", label: "Confirmed" },
  { id: "held", label: "Held / Expiring" },
  { id: "checked_in", label: "Checked-In" },
  { id: "checked_out", label: "Checked-Out" },
  { id: "cancelled", label: "Cancelled" },
];

const FLAG: Record<string, string> = {
  French: "🇫🇷",
  German: "🇩🇪",
  Swiss: "🇨🇭",
  Singaporean: "🇸🇬",
  Bhutanese: "🇧🇹",
  Indian: "🇮🇳",
  Italian: "🇮🇹",
  American: "🇺🇸",
  British: "🇬🇧",
  Japanese: "🇯🇵",
};

function statusTone(
  status: BookingStatus,
  unpaid: boolean,
): "success" | "vip" | "danger" | "default" | "muted" | "teal" {
  if (unpaid) return "danger";
  if (status === "checked_in") return "success";
  if (status === "held") return "vip";
  if (status === "cancelled" || status === "no_show") return "danger";
  if (status === "confirmed") return "default";
  if (status === "checked_out") return "muted";
  return "teal";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ReservationsPage() {
  const navigate = useNavigate();
  const stays = useFrontOfficeStore((s) => s.stays);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const checkIn = useFrontOfficeStore((s) => s.checkIn);
  const agents = useCommercialStore((s) => s.agents);
  const cells = useCommercialStore((s) => s.cells);
  const rateCards = useCommercialStore((s) => s.rateCards);
  const season = useCommercialStore((s) => s.season);
  const mealPlan = useCommercialStore((s) => s.mealPlan);
  const mouLinks = useMouStore((s) => s.links);
  const fiscalDocs = useExtrasStore((s) => s.fiscalDocs);
  const changeRequests = usePartnerPortalStore((s) => s.changeRequests);
  const [params, setParams] = useSearchParams();

  const [filter, setFilter] = useState<ResStatusTab>("all");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [moneyChip, setMoneyChip] = useState<ResMoneyChip>("none");
  const [sort, setSort] = useState<ResSortKey>("arrival");

  const bd = businessDate || todayIso();

  useEffect(() => {
    if (params.get("fastBook") === "1") {
      openFastBook();
      params.delete("fastBook");
      setParams(params, { replace: true });
    }
    const chip = params.get("money");
    if (
      chip === "follow_up" ||
      chip === "balance_due" ||
      chip === "agent_only" ||
      chip === "unassigned"
    ) {
      setMoneyChip(chip);
    }
  }, [params, setParams, openFastBook]);

  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of stays) map[s.id] = folioBalance(s);
    return map;
  }, [stays]);

  const paidById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of stays) map[s.id] = folioTotals(s).paid;
    return map;
  }, [stays]);

  const agencies = useMemo(() => agencyOptions(stays), [stays]);

  const filtered = useMemo(
    () =>
      filterReservations({
        stays,
        balances,
        status: filter,
        source: sourceFilter,
        agent: agentFilter,
        query,
        fromDate,
        toDate,
        moneyChip,
        sort,
      }) as Stay[],
    [
      stays,
      balances,
      filter,
      sourceFilter,
      agentFilter,
      query,
      fromDate,
      toDate,
      moneyChip,
      sort,
    ],
  );

  const unpaidNow = useMemo(() => sumUnpaidNow(stays, balances), [stays, balances]);
  const followUpCount = useMemo(
    () => countFollowUp(stays, balances),
    [stays, balances],
  );
  const held = stays.filter((s) => s.status === "held").length;
  const unassignedCount = stays.filter((s) => isUnassignedLive(s)).length;
  const viewUnpaid = filtered.reduce(
    (n, s) => n + Math.max(0, balances[s.id] ?? 0),
    0,
  );

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
        depositAwaitingByAgent: {},
        businessDate: bd,
        propertyId: DEMO_MOU_PROPERTY_ID,
      }),
    [agents, mouLinks, rateCards, cells, season, mealPlan, stays, fiscalDocs, bd],
  );

  const agentDuesRows = useMemo(
    () =>
      partneredRows
        .filter((r) => r.arOutstanding > 0.5)
        .sort((a, b) => b.arOutstanding - a.arOutstanding),
    [partneredRows],
  );
  const agentDuesTotal = agentDuesRows.reduce((n, r) => n + r.arOutstanding, 0);
  const pendingChanges = changeRequests.filter((c) => c.status === "pending").length;

  const clearFilters = () => {
    setFilter("all");
    setQuery("");
    setSourceFilter("all");
    setAgentFilter("all");
    setFromDate("");
    setToDate("");
    setMoneyChip("none");
    setSort("arrival");
  };

  const setDatePreset = (preset: "today" | "tomorrow" | "week") => {
    if (preset === "today") {
      setFromDate(bd);
      setToDate(bd);
      return;
    }
    if (preset === "tomorrow") {
      const t = addDaysIso(bd, 1);
      setFromDate(t);
      setToDate(t);
      return;
    }
    setFromDate(bd);
    setToDate(addDaysIso(bd, 6));
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const csv = reservationsToCsv(filtered, balances, paidById);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservations-${bd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} reservations`);
  };

  const printList = () => {
    if (filtered.length === 0) {
      toast.error("Nothing to print");
      return;
    }
    try {
      const rows = filtered
        .map((s) => {
          const bal = balances[s.id] ?? 0;
          const paid = paidById[s.id] ?? 0;
          return `<tr>
            <td>${escapePrintHtml(s.confirmationNo)}</td>
            <td>${escapePrintHtml(s.guestName)}</td>
            <td>${escapePrintHtml(s.status)}</td>
            <td>${escapePrintHtml(s.checkIn)} → ${escapePrintHtml(s.checkOut)}</td>
            <td>${escapePrintHtml(s.roomNumber ?? "—")}</td>
            <td>${escapePrintHtml(s.agencyName ?? s.source)}</td>
            <td style="text-align:right">${paid.toFixed(2)}</td>
            <td style="text-align:right">${bal.toFixed(2)}</td>
          </tr>`;
        })
        .join("");
      printHtmlDocument(
        `<!doctype html><html><head><title>Reservations</title>
<style>
  body{font-family:Georgia,serif;padding:24px;color:#111}
  h1{font-size:20px;margin:0 0 6px}
  .meta{color:#555;font-size:13px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #ccc;padding:6px 8px}
  th{background:#f4f4f4;text-align:left}
</style></head><body>
<h1>Reservations</h1>
<div class="meta">${escapePrintHtml(bd)} · ${filtered.length} row(s) · Unpaid in view Nu ${viewUnpaid.toFixed(2)}</div>
<table>
  <thead><tr><th>Conf</th><th>Guest</th><th>Status</th><th>Stay</th><th>Room</th><th>Agent</th><th>Paid</th><th>Balance</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`,
        "Reservations",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    }
  };

  const exportManifest = async () => {
    const asOfDate = bd;
    let rows: string[][] = [];
    let source: "postgres" | "local_demo" = "local_demo";
    try {
      const api = await runCommand<{
        rows: Array<{
          confirmationNo: string;
          guestName: string;
          passportOrCid: string | null;
          nationality: string | null;
          checkIn: string;
          checkOut: string;
          roomNumber: string | null;
          guideLicense: string | null;
          vehiclePlate: string | null;
          status: string;
        }>;
      }>("compliance.immigrationManifest", { asOfDate });
      if (api.ok) {
        source = "postgres";
        rows = api.data.rows.map((r) => [
          r.confirmationNo,
          r.guestName,
          r.passportOrCid ?? "",
          r.nationality ?? "",
          r.checkIn,
          r.checkOut,
          r.roomNumber ?? "unassigned",
          r.status,
          r.guideLicense ?? "",
          r.vehiclePlate ?? "",
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Reservations] immigration API", { err: msg });
    }
    if (rows.length === 0) {
      rows = filtered.map((s) => [
        s.confirmationNo,
        s.guestName,
        s.passportOrCid,
        s.nationality,
        s.checkIn,
        s.checkOut,
        s.roomNumber ?? "unassigned",
        s.status,
        s.mealPlan,
        "",
      ]);
    }
    const csv = [
      "Ref,Guest,Passport/CID,Nationality,CheckIn,CheckOut,Room,Status,GuideLicense,VehiclePlate",
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tourist-manifest-${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Tourist manifest exported", {
      description: `${rows.length} rows · ${source === "postgres" ? "API" : "local"} · Immigration / RBP`,
    });
  };

  const chipClass = (active: boolean, tone: "ruby" | "brass" | "brand" = "brand") =>
    `rounded-full border px-3 py-1.5 text-[11px] font-bold ${
      active
        ? tone === "ruby"
          ? "border-[rgba(239,68,68,0.5)] bg-[rgba(239,68,68,0.12)] text-[var(--hos-ruby)]"
          : tone === "brass"
            ? "border-[rgba(245,158,11,0.5)] bg-[rgba(245,158,11,0.14)] text-[var(--hos-brass-ink)]"
            : "border-[rgba(37,99,235,0.45)] bg-[rgba(37,99,235,0.12)] text-[var(--hos-primary)]"
        : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
    }`;

  return (
    <ModuleFrame
      title="Reservations"
      description="Bookings · dues · follow-up · export / print"
      eyebrow="Reservation desk"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "conf", label: "Confirmed", swatch: "var(--hos-primary)" },
              { id: "held", label: "Held", swatch: "var(--hos-brass)" },
              { id: "in", label: "In-house", swatch: "var(--hos-emerald)" },
              { id: "due", label: "Unpaid", swatch: "var(--hos-ruby)" },
            ]}
          />
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={printList}>
            Print list
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void exportManifest()}>
            Manifest
          </Button>
          <Button size="sm" onClick={() => openFastBook()}>
            Fast Book ⌘B
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            className="text-left"
            onClick={() => setMoneyChip(moneyChip === "balance_due" ? "none" : "balance_due")}
          >
            <KpiCard label="Unpaid now" value={formatNu(unpaidNow)} delta="In-house + arriving" />
          </button>
          <button
            type="button"
            className="text-left"
            onClick={() => {
              setFilter("checked_out");
              setMoneyChip("follow_up");
            }}
          >
            <KpiCard
              label="Follow-up"
              value={followUpCount}
              delta="Checkout unpaid"
            />
          </button>
          <Link to="/agents?filter=unpaid" className="text-left no-underline">
            <KpiCard
              label="Agent dues"
              value={formatNu(agentDuesTotal)}
              delta={`${agentDuesRows.length} operators`}
            />
          </Link>
          <button
            type="button"
            className="text-left"
            onClick={() => {
              setFilter("held");
              setMoneyChip("none");
            }}
          >
            <KpiCard label="Holds" value={held} delta="Tap to filter" />
          </button>
        </div>

        <GlassPanel className="flex flex-col gap-3 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-[10px] font-bold uppercase tracking-wider text-[var(--hos-ink-3)]">
              Follow-up & queues
            </strong>
            <button
              type="button"
              className={chipClass(moneyChip === "follow_up", "ruby")}
              onClick={() => {
                setFilter("checked_out");
                setMoneyChip(moneyChip === "follow_up" ? "none" : "follow_up");
              }}
            >
              Follow-up · {followUpCount}
            </button>
            <button
              type="button"
              className={chipClass(moneyChip === "unassigned", "brass")}
              onClick={() =>
                setMoneyChip(moneyChip === "unassigned" ? "none" : "unassigned")
              }
            >
              Unassigned · {unassignedCount}
            </button>
            <button
              type="button"
              className={chipClass(filter === "held", "brass")}
              onClick={() => {
                setFilter("held");
                setMoneyChip("none");
              }}
            >
              Holds · {held}
            </button>
            <span className="rounded-full border border-[var(--hos-line)] px-3 py-1.5 text-[11px] font-semibold text-[var(--hos-ink-3)]">
              Change requests · {pendingChanges}
            </span>
            <Link
              to="/stayview"
              className="rounded-full border border-[var(--hos-line)] px-3 py-1.5 text-[11px] font-bold text-[var(--hos-ink-2)] no-underline"
            >
              StayView
            </Link>
          </div>

          {agentDuesRows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hos-line)] pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--hos-ink-3)]">
                Top unpaid agents
              </span>
              {agentDuesRows.slice(0, 3).map((r) => (
                <button
                  key={r.agentId}
                  type="button"
                  className="rounded-xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.06)] px-3 py-1.5 text-left"
                  onClick={() =>
                    navigate(`/agents?filter=unpaid&agent=${encodeURIComponent(r.code)}`)
                  }
                >
                  <div className="text-[11px] font-bold text-[var(--hos-ink)]">{r.name}</div>
                  <div className="font-mono text-[10px] text-[var(--hos-ruby)]">
                    {formatNu(r.arOutstanding)}
                  </div>
                </button>
              ))}
              <Link
                to="/agents?filter=unpaid"
                className="text-[11px] font-bold text-[var(--hos-primary)] no-underline"
              >
                See all →
              </Link>
            </div>
          ) : null}
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-3 p-3.5">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guest, ref, room, group, phone, agency…"
              className="w-full rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3.5 py-2 text-sm text-[var(--hos-ink)] outline-none focus:border-[var(--hos-primary)] lg:max-w-md"
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs font-medium text-[var(--hos-ink)]"
            >
              <option value="all">All sources</option>
              <option value="direct">Direct</option>
              <option value="walk_in">Walk-in</option>
              <option value="agent">Agent</option>
              <option value="ota">OTA</option>
            </select>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs font-medium text-[var(--hos-ink)]"
              aria-label="Filter by agency"
            >
              <option value="all">All agencies</option>
              {agencies.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ResSortKey)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs font-medium text-[var(--hos-ink)]"
            >
              <option value="arrival">Sort: Arrival</option>
              <option value="departure">Sort: Departure</option>
              <option value="guest">Sort: Guest</option>
              <option value="balance">Sort: Balance</option>
              <option value="conf">Sort: Conf #</option>
            </select>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
              From
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 block rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
              To
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 block rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              />
            </label>
            <Button size="sm" variant="ghost" onClick={() => setDatePreset("today")}>
              Today
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDatePreset("tomorrow")}>
              Tomorrow
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDatePreset("week")}>
              This week
            </Button>
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chipClass(moneyChip === "balance_due", "ruby")}
              onClick={() =>
                setMoneyChip(moneyChip === "balance_due" ? "none" : "balance_due")
              }
            >
              Balance due
            </button>
            <button
              type="button"
              className={chipClass(moneyChip === "follow_up", "ruby")}
              onClick={() =>
                setMoneyChip(moneyChip === "follow_up" ? "none" : "follow_up")
              }
            >
              Checkout unpaid
            </button>
            <button
              type="button"
              className={chipClass(moneyChip === "agent_only")}
              onClick={() =>
                setMoneyChip(moneyChip === "agent_only" ? "none" : "agent_only")
              }
            >
              Agent bookings
            </button>
            <button
              type="button"
              className={chipClass(moneyChip === "unassigned", "brass")}
              onClick={() =>
                setMoneyChip(moneyChip === "unassigned" ? "none" : "unassigned")
              }
            >
              Unassigned
            </button>
          </div>

          <MorphTabs
            glowId="activeTabGlow"
            value={filter}
            onChange={setFilter}
            items={FILTERS}
          />

          <p className="m-0 text-[12px] font-semibold text-[var(--hos-ink-2)]">
            {filtered.length} reservations · Unpaid in view {formatNu(viewUnpaid)}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              title="No reservations match"
              description="Clear filters or create a booking with Fast Book."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                  <Button size="sm" onClick={() => openFastBook()}>
                    Fast Book
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <ul className="m-0 grid list-none gap-2 p-0 lg:hidden">
                {filtered.map((s) => {
                  const bal = balances[s.id] ?? 0;
                  const paid = paidById[s.id] ?? 0;
                  const flag = FLAG[s.nationality] ?? "🏳️";
                  return (
                    <li key={s.id}>
                      <div className="hos-cell flex min-h-12 w-full flex-col gap-2 rounded-xl p-3">
                        <button
                          type="button"
                          onClick={() => openStay(s.id)}
                          className="flex w-full flex-col gap-2 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--hos-primary),#6366f1)] text-[10px] font-bold text-white">
                              {initials(s.guestName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1 font-semibold text-[var(--hos-ink)]">
                                <span className="truncate">{s.guestName}</span>
                                <span>{flag}</span>
                              </div>
                              <div className="font-mono text-[10px] text-[var(--hos-primary)]">
                                {s.confirmationNo}
                              </div>
                            </div>
                            <Badge tone={statusTone(s.status, bal > 0.5)}>
                              {s.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--hos-ink-3)]">
                            <span className="tabular-nums">
                              {s.checkIn} → {s.checkOut}
                            </span>
                            <span>
                              {s.roomNumber ? `Rm ${s.roomNumber}` : "unassigned"}
                              {s.agencyName ? ` · ${s.agencyName}` : ""}
                            </span>
                            <span
                              className={`tabular-nums font-semibold ${
                                bal > 0 ? "text-[var(--hos-ruby)]" : "text-[var(--hos-ink)]"
                              }`}
                            >
                              Due {formatNu(bal)}
                            </span>
                          </div>
                          <PaidUnpaidBar paid={paid} unpaid={bal} showLabels={false} />
                        </button>
                        {s.source === "agent" && bal > 0.5 ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              navigate(
                                `/agents?filter=unpaid&agent=${encodeURIComponent(
                                  s.agencyName ?? "",
                                )}&print=1`,
                              )
                            }
                          >
                            Print statement
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] lg:block">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="sticky top-0 z-[1] bg-[var(--hos-cell)]">
                    <tr className="border-b border-[var(--hos-line)] text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                      <th className="px-3 py-2.5">Guest</th>
                      <th className="px-3 py-2.5">Conf #</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">In → Out</th>
                      <th className="px-3 py-2.5">Room</th>
                      <th className="px-3 py-2.5">Source / Agent</th>
                      <th className="px-3 py-2.5">Paid / Unpaid</th>
                      <th className="px-3 py-2.5 text-right">Balance</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)]">
                    {filtered.map((s) => {
                      const bal = balances[s.id] ?? 0;
                      const paid = paidById[s.id] ?? 0;
                      const flag = FLAG[s.nationality] ?? "🏳️";
                      const follow = isCheckoutUnpaid(s, bal);
                      return (
                        <tr
                          key={s.id}
                          className="group hover:bg-[rgba(37,99,235,0.04)]"
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--hos-primary),#6366f1)] text-[10px] font-bold text-white">
                                {initials(s.guestName)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1 font-semibold text-[var(--hos-ink)]">
                                  <span className="truncate">{s.guestName}</span>
                                  <span title={s.nationality}>{flag}</span>
                                  {s.vip ? <Badge tone="vip">VIP</Badge> : null}
                                  {follow ? <Badge tone="danger">Follow-up</Badge> : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-[var(--hos-primary)]">
                            {s.confirmationNo}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge tone={statusTone(s.status, bal > 0.5)}>
                              {s.status.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-[var(--hos-ink-2)]">
                            {s.checkIn} → {s.checkOut}
                          </td>
                          <td className="px-3 py-2.5">
                            {s.roomNumber ? (
                              <span className="rounded-md bg-[rgba(37,99,235,0.1)] px-2 py-0.5 font-mono font-bold text-[var(--hos-primary)]">
                                {s.roomNumber}
                              </span>
                            ) : (
                              <span className="text-[var(--hos-ruby)]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[var(--hos-ink-2)]">
                            <div className="capitalize">{s.source.replace("_", " ")}</div>
                            {s.agencyName ? (
                              <div className="text-[10px] text-[var(--hos-teal)]">
                                {s.agencyName}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 min-w-[120px]">
                            <PaidUnpaidBar paid={paid} unpaid={bal} showLabels={false} />
                            <div className="mt-0.5 flex justify-between font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)]">
                              <span>{formatNu(paid)}</span>
                              <span>{formatNu(bal)}</span>
                            </div>
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${
                              bal > 0
                                ? "text-[var(--hos-ruby)]"
                                : "text-[var(--hos-emerald)]"
                            }`}
                          >
                            {formatNu(bal)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex justify-end gap-1 opacity-90">
                              {["confirmed", "held"].includes(s.status) && s.roomId ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void (async () => {
                                      const res = await checkIn(s.id);
                                      if (!res.ok) toast.error(res.error);
                                      else
                                        toast.success(
                                          `Checked in · Rm ${s.roomNumber}`,
                                        );
                                    })();
                                  }}
                                >
                                  Check-in
                                </Button>
                              ) : null}
                              {s.source === "agent" && bal > 0.5 ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                      `/agents?filter=unpaid&agent=${encodeURIComponent(
                                        s.agencyName ?? "",
                                      )}&print=1`,
                                    );
                                  }}
                                >
                                  Statement
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStay(s.id);
                                }}
                              >
                                Open
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </GlassPanel>
      </div>
    </ModuleFrame>
  );
}
