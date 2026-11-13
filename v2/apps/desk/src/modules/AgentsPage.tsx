import { Drawer } from "vaul";
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  Copy,
  FileText,
  Printer,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { Link } from "react-router-dom";
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
  TYPES,
  cellsForCard,
  rateCardById,
  useCommercialStore,
  type Agent,
  type MealPlan,
  type Season,
} from "../lib/commercial-store";
import { buildPartneredAgentRows } from "../lib/b2b-portfolio";
import { DEMO_MOU_PROPERTY_ID, useMouStore } from "../lib/mou-store";
import { usePartnerPortalStore } from "../lib/partner-portal-store";
import { useExtrasStore } from "../lib/extras-store";
import { formatNu, useFrontOfficeStore } from "../lib/front-office-store";
import { RateSheetShareModal } from "./RateSheetShareModal";
import { PaidUnpaidBar } from "./PaidUnpaidBar";
import { AgentPrintPackOverlay } from "./AgentPrintPackOverlay";

type SortKey = "name" | "ar" | "headroom" | "aging90";
type FilterKey = "all" | "active" | "near_limit" | "aging";

type ActionRailItem = {
  agentId: string;
  title: string;
  detail: string;
  tone: "ruby" | "brass" | "brand";
  score: number;
};

function agingTotal(a: Agent): number {
  return a.aging.current + a.aging.d30 + a.aging.d60 + a.aging.d90;
}

function headroom(a: Agent): number {
  return Math.max(0, a.creditLimit - a.usedCredit);
}

function creditPct(a: Agent): number {
  return a.creditLimit ? Math.round((a.usedCredit / a.creditLimit) * 100) : 0;
}

function buildSoaText(agent: Agent, asOf: string, rateCardCode: string): string {
  const lines = [
    "STATEMENT OF ACCOUNT — B2B CITY LEDGER",
    `Property: Demo Hotel · Desk Glacier`,
    `Operator: ${agent.name} (${agent.code})`,
    `Contact: ${agent.contact}`,
    `Rate card: ${rateCardCode} · Net terms ${agent.termsDays} days`,
    `As of: ${asOf}`,
    "",
    "AGING WATERFALL (Nu.)",
    `  Current .............. ${Math.round(agent.aging.current).toLocaleString("en-BT")}`,
    `  30 days .............. ${Math.round(agent.aging.d30).toLocaleString("en-BT")}`,
    `  60 days .............. ${Math.round(agent.aging.d60).toLocaleString("en-BT")}`,
    `  90+ days ............. ${Math.round(agent.aging.d90).toLocaleString("en-BT")}`,
    "  ─────────────────────────────",
    `  Total AR ............. ${Math.round(agent.usedCredit).toLocaleString("en-BT")}`,
    `  Credit limit ......... ${Math.round(agent.creditLimit).toLocaleString("en-BT")}`,
    `  Headroom ............. ${Math.round(headroom(agent)).toLocaleString("en-BT")}`,
    "",
    "Payment instructions: Bhutan National Bank · TPN on wire slip",
    "— End of SOA preview —",
  ];
  return lines.join("\n");
}

function rankActionToday(agents: Agent[]): ActionRailItem[] {
  const raw: ActionRailItem[] = [];
  for (const a of agents.filter((x) => x.active)) {
    const pct = creditPct(a);
    if (a.usedCredit > a.creditLimit) {
      raw.push({
        agentId: a.id,
        title: a.code,
        detail: `Over limit · ${formatNu(a.usedCredit - a.creditLimit)}`,
        tone: "ruby",
        score: 10_000 + (a.usedCredit - a.creditLimit),
      });
    } else if (a.aging.d90 > 0) {
      raw.push({
        agentId: a.id,
        title: a.code,
        detail: `90d aging · ${formatNu(a.aging.d90)}`,
        tone: "ruby",
        score: 5_000 + a.aging.d90,
      });
    } else if (pct >= 85) {
      raw.push({
        agentId: a.id,
        title: a.code,
        detail: `Near limit · ${pct}% · headroom ${formatNu(headroom(a))}`,
        tone: "brass",
        score: 3_000 + pct,
      });
    } else if (pct >= 70) {
      raw.push({
        agentId: a.id,
        title: a.code,
        detail: `Allotment pressure · ${pct}% used`,
        tone: "brand",
        score: 2_000 + pct,
      });
    }
  }
  const best = new Map<string, ActionRailItem>();
  for (const item of raw) {
    const cur = best.get(item.agentId);
    if (!cur || item.score > cur.score) best.set(item.agentId, item);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

function mouRateSnapshot(
  rateCardId: string,
  cells: ReturnType<typeof useCommercialStore.getState>["cells"],
  season: ReturnType<typeof useCommercialStore.getState>["season"],
  mealPlan: ReturnType<typeof useCommercialStore.getState>["mealPlan"],
) {
  const slice = cellsForCard(cells, rateCardId, season, mealPlan);
  return TYPES.map((t) => {
    const cell = slice.find((c) => c.typeCode === t.code);
    return { type: t, net: cell?.netAmount ?? 0 };
  });
}

export function AgentsPage() {
  const reduce = useReducedMotion();
  const [, start] = useTransition();
  const agents = useCommercialStore((s) => s.agents);
  const cells = useCommercialStore((s) => s.cells);
  const rateCards = useCommercialStore((s) => s.rateCards);
  const season = useCommercialStore((s) => s.season);
  const mealPlan = useCommercialStore((s) => s.mealPlan);
  const setSeason = useCommercialStore((s) => s.setSeason);
  const setMealPlan = useCommercialStore((s) => s.setMealPlan);
  const bookAllotment = useCommercialStore((s) => s.bookAllotment);
  const recordPayment = useCommercialStore((s) => s.recordPayment);
  const allocateWireBatch = useCommercialStore((s) => s.allocateWireBatch);
  const assignAgentRateCard = useCommercialStore((s) => s.assignAgentRateCard);
  const setNetRate = useCommercialStore((s) => s.setNetRate);
  const changeRequests = usePartnerPortalStore((s) => s.changeRequests);
  const deskReviewChange = usePartnerPortalStore((s) => s.deskReviewChange);
  const depositSlips = usePartnerPortalStore((s) => s.depositSlips);
  const verifyDeposit = usePartnerPortalStore((s) => s.verifyDeposit);
  const proposeMou = useMouStore((s) => s.propose);
  const decideMou = useMouStore((s) => s.decide);
  const mouLinks = useMouStore((s) => s.links);
  const fiscalDocs = useExtrasStore((s) => s.fiscalDocs);
  const stays = useFrontOfficeStore((s) => s.stays);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [selectedId, setSelectedId] = useState(agents[0]?.id ?? "");
  const [drawerOpen, setDrawerOpen] = useState(Boolean(agents[0]));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payAmt, setPayAmt] = useState(25000);
  const [bookAmt, setBookAmt] = useState(40000);
  const [wireAmt, setWireAmt] = useState(50000);
  const [wireRef, setWireRef] = useState("BNB-WIRE-");
  const [shareOpen, setShareOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementAgentId, setStatementAgentId] = useState<string | null>(null);

  const asOf = useMemo(
    () =>
      new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );

  const totalAR = agents.reduce((s, a) => s + a.usedCredit, 0);
  const aging90 = agents.reduce((s, a) => s + a.aging.d90, 0);
  const nearLimit = agents.filter((a) => creditPct(a) >= 70).length;
  const actionToday = useMemo(() => rankActionToday(agents), [agents]);

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
        businessDate: businessDate || new Date().toISOString().slice(0, 10),
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
      businessDate,
    ],
  );

  const activeMouCount = partneredRows.filter((r) => r.mouStatus === "active").length;
  const paidRollup = partneredRows.reduce((n, r) => n + r.paidTotal, 0);

  const directory = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = agents.filter((a) => {
      if (filter === "active" && !a.active) return false;
      if (filter === "near_limit" && creditPct(a) < 70) return false;
      if (filter === "aging" && a.aging.d90 <= 0) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.contact.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "ar") return b.usedCredit - a.usedCredit;
      if (sort === "headroom") return headroom(a) - headroom(b);
      if (sort === "aging90") return b.aging.d90 - a.aging.d90;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [agents, query, filter, sort]);

  const selected =
    agents.find((a) => a.id === selectedId) ?? directory[0] ?? agents[0];

  const soaText = useMemo(
    () =>
      selected
        ? buildSoaText(
            selected,
            asOf,
            rateCardById(rateCards, selected.rateCardId)?.code ?? selected.rateCardId,
          )
        : "",
    [selected, asOf, rateCards],
  );

  const activeCards = useMemo(
    () => rateCards.filter((c) => c.active),
    [rateCards],
  );

  const selectedCard = selected
    ? rateCardById(rateCards, selected.rateCardId)
    : undefined;

  const mouRates = useMemo(() => {
    if (!selected) return [];
    return mouRateSnapshot(selected.rateCardId, cells, season, mealPlan);
  }, [selected, cells, season, mealPlan]);

  const open360 = (agentId: string) => {
    setSelectedId(agentId);
    setDrawerOpen(true);
  };

  const openStatement = (agentId: string) => {
    setSelectedId(agentId);
    setStatementAgentId(agentId);
    setStatementOpen(true);
  };

  const statementAgent =
    agents.find((a) => a.id === statementAgentId) ?? selected ?? null;

  const toggleBatch = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copySoa = async () => {
    if (!soaText) return;
    try {
      await navigator.clipboard.writeText(soaText);
      toast.success("SOA copied to clipboard");
    } catch {
      toast.error("Copy failed", { description: "Select the preview text manually" });
    }
  };

  return (
    <ModuleFrame
      title="B2B Agents & MoU"
      description="Partnered agents · MoU rates · payments · FO status · credit aging · SOA"
      actions={
        <>
          <StatusLegend
            dense
            className="hidden lg:flex"
            items={[
              { id: "ok", label: "Within limit", swatch: "var(--hos-emerald)" },
              { id: "near", label: "Near limit", swatch: "var(--hos-brass)" },
              { id: "over", label: "Overdue", swatch: "var(--hos-ruby)" },
            ]}
          />
          <Button size="sm" variant="secondary" asChild>
            <Link to="/partner">
              <Users className="size-3.5" aria-hidden />
              Partner portal
            </Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/finance">
              <Wallet className="size-3.5" aria-hidden />
              Finance hub
            </Link>
          </Button>
        </>
      }
    >
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Active operators" value={agents.filter((a) => a.active).length} />
        <KpiCard label="Active MoUs" value={activeMouCount} delta="Partnered" />
        <KpiCard label="AR outstanding" value={formatNu(totalAR)} delta="Credit used" />
        <KpiCard label="Paid (fiscal)" value={formatNu(paidRollup)} delta="Collected" />
        <KpiCard
          label="90d bucket"
          value={formatNu(aging90)}
          delta={aging90 > 0 ? "Collect priority" : "Clear"}
        />
        <KpiCard label="Near limit" value={nearLimit} delta="≥70% utilised" />
      </div>

      <GlassPanel className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <strong className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--hos-ink-3)]">
            <TrendingUp className="size-3.5" aria-hidden />
            Action today
          </strong>
          <span className="text-[10px] text-[var(--hos-ink-3)]">Tap for operator 360</span>
        </div>
        {actionToday.length === 0 ? (
          <p className="m-0 text-xs text-[var(--hos-ink-3)]">
            No operators over limit or in 90d aging — monitor headroom on allotments.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {actionToday.map((item) => (
              <motion.button
                key={item.agentId}
                type="button"
                whileTap={reduce ? undefined : { scale: 0.98 }}
                onClick={() => open360(item.agentId)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left ${
                  item.tone === "ruby"
                    ? "border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.08)]"
                    : item.tone === "brass"
                      ? "border-[rgba(245,158,11,0.45)] bg-[rgba(245,158,11,0.1)]"
                      : "border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.08)]"
                }`}
              >
                <div className="text-[11px] font-bold text-[var(--hos-ink)]">{item.title}</div>
                <div className="mt-0.5 text-[10px] text-[var(--hos-ink-3)]">{item.detail}</div>
              </motion.button>
            ))}
          </div>
        )}
      </GlassPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <GlassTiltCard className="flex flex-col gap-3 p-3.5" glowColor="brand">
          <div className="flex flex-wrap items-center gap-2">
            <div className="hos-search-field min-w-[160px] flex-1">
              <Search className="hos-search-icon" strokeWidth={1.75} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search operator, code, contact…"
                className="hos-search-input w-full rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] py-2 text-xs outline-none focus:border-[var(--hos-primary)]"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterKey)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-[11px] font-semibold"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="near_limit">Near limit</option>
              <option value="aging">90d aging</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-[11px] font-semibold"
            >
              <option value="name">Sort: Name</option>
              <option value="ar">Sort: AR</option>
              <option value="headroom">Sort: Headroom</option>
              <option value="aging90">Sort: 90d</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2">
            <ArrowRightLeft className="size-3.5 text-[var(--hos-primary)]" aria-hidden />
            <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">Batch wire</span>
            <input
              type="number"
              value={wireAmt}
              onChange={(e) => setWireAmt(Number(e.target.value) || 0)}
              className="w-24 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-surface)] px-2 py-1 text-xs"
              aria-label="Wire amount"
            />
            <input
              value={wireRef}
              onChange={(e) => setWireRef(e.target.value)}
              placeholder="Bank ref"
              className="min-w-[120px] flex-1 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-surface)] px-2 py-1 text-xs"
            />
            <Button
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => {
                start(() => {
                  const res = allocateWireBatch([...selectedIds], wireAmt);
                  if (!res.ok) {
                    toast.error(res.error, {
                      description: "Select operators with open AR · wire applies 90+→current",
                    });
                    return;
                  }
                  toast.success(`Wire ${formatNu(res.applied)} allocated`, {
                    description: wireRef ? `Ref ${wireRef}` : "Aging buckets updated",
                  });
                  setSelectedIds(new Set());
                });
              }}
            >
              Apply to {selectedIds.size || "…"} selected
            </Button>
          </div>

          {directory.length === 0 ? (
            <EmptyState
              title="No operators match"
              description="Clear filters or onboard a B2B agent in Super Admin."
              action={
                <Button size="sm" variant="secondary" onClick={() => { setQuery(""); setFilter("all"); }}>
                  Reset filters
                </Button>
              }
            />
          ) : agents.length === 0 ? (
            <EmptyState title="No agents" description="Seed commercial operators to run city ledger." />
          ) : (
            <>
            <ul className="m-0 grid list-none gap-2 p-0 md:hidden">
              {directory.map((a) => {
                const row = partneredRows.find((r) => r.agentId === a.id);
                const ar = row?.arOutstanding ?? a.usedCredit;
                const paid = row?.paidTotal ?? 0;
                return (
                  <li key={a.id}>
                    <div className="hos-cell flex w-full flex-col gap-1.5 rounded-xl border border-[var(--hos-line)] p-3 text-left">
                      <button
                        type="button"
                        onClick={() => open360(a.id)}
                        className="flex w-full flex-col gap-1.5 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <strong className="min-w-0 truncate text-[13px] text-[var(--hos-ink)]">
                            {a.name}
                          </strong>
                          <Badge tone="teal">{a.code}</Badge>
                        </div>
                        <div className="text-[11px] text-[var(--hos-ink-3)]">
                          {row?.mouStatus ?? "no MoU"} · {row?.rateCardCode ?? "—"}
                        </div>
                        <div className="flex justify-between font-mono text-[12px] tabular-nums">
                          <span className="text-[var(--hos-ink-3)]">AR</span>
                          <span className="font-semibold text-[var(--hos-ink)]">
                            {formatNu(ar)}
                          </span>
                        </div>
                        <PaidUnpaidBar paid={paid} unpaid={ar} showLabels={false} />
                      </button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={() => openStatement(a.id)}
                      >
                        <FileText className="size-3.5" aria-hidden />
                        Print pack
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] md:block">
              <table
                className="w-full min-w-[960px] text-left text-xs"
                data-testid="agents-partnered-directory"
              >
                <thead>
                  <tr className="border-b border-[var(--hos-line)] bg-[var(--hos-surface)] text-[10px] uppercase tracking-wide text-[var(--hos-ink-3)]">
                    <th className="w-8 px-2 py-2" />
                    <th className="px-3 py-2">Operator</th>
                    <th className="px-3 py-2">MoU status</th>
                    <th className="px-3 py-2">Rate card</th>
                    <th className="px-3 py-2 text-right">Dbl net</th>
                    <th className="px-3 py-2 text-right">AR</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2">Paid / unpaid</th>
                    <th className="px-3 py-2 text-right">FO</th>
                    <th className="px-3 py-2">Utilisation</th>
                    <th className="px-3 py-2 text-right">90d</th>
                    <th className="px-3 py-2">Print pack</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hos-line)]">
                  {directory.map((a) => {
                    const pct = creditPct(a);
                    const checked = selectedIds.has(a.id);
                    const rowSelected = selected?.id === a.id;
                    const row = partneredRows.find((r) => r.agentId === a.id);
                    const mouTone =
                      row?.mouStatus === "active"
                        ? ("success" as const)
                        : row?.mouStatus === "pending_counterparty"
                          ? ("vip" as const)
                          : row?.mouStatus === "none"
                            ? ("muted" as const)
                            : ("teal" as const);
                    return (
                      <tr
                        key={a.id}
                        className={`cursor-pointer ${rowSelected ? "bg-[rgba(59,130,246,0.06)]" : "hover:bg-[rgba(15,23,42,0.02)]"}`}
                        onClick={() => open360(a.id)}
                      >
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBatch(a.id)}
                            aria-label={`Select ${a.code}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-[var(--hos-ink)]">{a.name}</div>
                          <div className="text-[10px] text-[var(--hos-ink-3)]">
                            {a.code} · {a.contact}
                            {row?.creditHold ? " · HOLD" : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={mouTone}>{row?.mouStatus ?? "—"}</Badge>
                          {row?.depositAwaiting ? (
                            <span className="ml-1 text-[10px] text-[var(--hos-brass)]">
                              {row.depositAwaiting} proof
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">
                          {row?.rateCardCode ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {row?.doubleNet != null ? formatNu(row.doubleNet) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                          {formatNu(row?.arOutstanding ?? a.usedCredit)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--hos-emerald)]">
                          {formatNu(row?.paidTotal ?? 0)}
                        </td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <PaidUnpaidBar
                            className="min-w-[7rem]"
                            paid={row?.paidTotal ?? 0}
                            unpaid={row?.arOutstanding ?? a.usedCredit}
                            showLabels={false}
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-[10px] text-[var(--hos-ink-3)]">
                          {row
                            ? `${row.staysInHouse} IH · ${row.staysHeld} held · ${row.staysArriving} arr`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                            <div
                              className={`h-full ${pct > 85 ? "bg-[var(--hos-ruby)]" : pct > 70 ? "bg-[var(--hos-brass)]" : "bg-[var(--hos-primary)]"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold">{pct}%</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--hos-ruby)]">
                          {a.aging.d90 > 0 ? formatNu(a.aging.d90) : "—"}
                        </td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openStatement(a.id)}
                            data-testid="agents-print-pack-row"
                          >
                            <FileText className="size-3.5" aria-hidden />
                            Print pack
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </GlassTiltCard>

        <GlassTiltCard className="flex flex-col gap-2 p-3.5" glowColor="emerald">
          <div className="flex items-center justify-between gap-2">
            <strong className="flex items-center gap-1.5 text-sm text-[var(--hos-ink)]">
              <FileText className="size-4 text-[var(--hos-primary)]" aria-hidden />
              SOA preview
            </strong>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={copySoa} disabled={!selected}>
                <Copy className="size-3.5" aria-hidden />
                Copy
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!selected}
                onClick={() => window.print()}
              >
                <Printer className="size-3.5" aria-hidden />
                Print
              </Button>
            </div>
          </div>
          {selected ? (
            <pre className="m-0 max-h-[420px] overflow-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3 font-mono text-[10px] leading-relaxed text-[var(--hos-ink)] whitespace-pre-wrap">
              {soaText}
            </pre>
          ) : (
            <EmptyState title="No operator selected" description="Pick a row or Action today chip." />
          )}
          <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                  <th className="px-3 py-2">Bucket</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {selected ? (
                  (
                    [
                      ["Current", selected.aging.current],
                      ["30 days", selected.aging.d30],
                      ["60 days", selected.aging.d60],
                      ["90+ days", selected.aging.d90],
                    ] as const
                  ).map(([label, amt]) => (
                    <tr key={label} className="border-b border-[var(--hos-line)] last:border-0">
                      <td className="px-3 py-2">{label}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatNu(amt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-center text-[var(--hos-ink-3)]">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassTiltCard>
      </div>

      <Drawer.Root open={drawerOpen && Boolean(selected)} onOpenChange={setDrawerOpen} direction="right">
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-[rgba(15,23,42,0.55)]" />
          <Drawer.Content className="fixed right-0 top-0 z-[61] flex h-full w-full max-w-[480px] flex-col border-l border-[var(--hos-line)] bg-[var(--hos-cell)] outline-none shadow-[-12px_0_40px_-16px_rgba(15,23,42,0.35)]">
            {selected ? (
              <>
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--hos-line)] bg-[var(--hos-cell)] p-4">
                  <div>
                    <Drawer.Title className="m-0 text-lg font-bold text-[var(--hos-ink)]">
                      Operator 360
                    </Drawer.Title>
                    <Drawer.Description className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
                      {selected.code} · {selected.name}
                    </Drawer.Description>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => openStatement(selected.id)}
                      data-testid="agents-print-pack-360"
                    >
                      <FileText className="size-3.5" aria-hidden />
                      Print pack
                    </Button>
                    <Link
                      to="/reports?intel=agents"
                      className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 text-[12px] font-semibold text-[var(--hos-ink-2)] no-underline"
                      data-testid="agents-insights-360"
                    >
                      Insights
                    </Link>
                    <Drawer.Close className="rounded-lg px-2 py-1 text-sm text-[var(--hos-ink-2)] hover:bg-[var(--hos-cell)]">
                      Close
                    </Drawer.Close>
                  </div>
                </div>
                <div className="hos-scroll-thin flex flex-1 flex-col gap-4 overflow-auto bg-[var(--hos-cell)] p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                      <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Credit limit</div>
                      <strong className="tabular-nums">{formatNu(selected.creditLimit)}</strong>
                    </div>
                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                      <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Headroom</div>
                      <strong className="tabular-nums text-[var(--hos-emerald)]">
                        {formatNu(headroom(selected))}
                      </strong>
                    </div>
                  </div>

                  {selected.usedCredit > selected.creditLimit ? (
                    <div className="flex items-center gap-2 rounded-xl border border-[rgba(239,68,68,0.4)] bg-[#fef2f2] px-3 py-2 text-xs text-[var(--hos-ruby)] dark:bg-[#450a0a]">
                      <AlertTriangle className="size-4 shrink-0" aria-hidden />
                      Over credit limit — block new allotment until wire received.
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-xs uppercase tracking-wide text-[var(--hos-ink-3)]">
                        Rate card ({selectedCard?.code ?? "—"} · {season} · {mealPlan})
                      </strong>
                      <div className="flex flex-wrap gap-2">
                        {selectedCard ? (
                          <Badge tone="teal">{selectedCard.kind}</Badge>
                        ) : null}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setShareOpen(true)}
                        >
                          Share MoU
                        </Button>
                        <Link
                          to="/rates"
                          className="inline-flex items-center text-[11px] font-semibold text-[var(--hos-primary)] hover:underline"
                        >
                          Full rates →
                        </Link>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["peak", "lean"] as Season[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSeason(s)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${
                            season === s
                              ? "border-[#111] bg-[#111] text-white"
                              : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                      {(["EP", "CP", "MAP", "AP"] as MealPlan[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMealPlan(m)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            mealPlan === m
                              ? "border-[#111] bg-[#111] text-white"
                              : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <label className="mt-2 flex flex-col gap-1 text-[11px]">
                      <span className="text-[var(--hos-ink-3)]">Assigned rate card</span>
                      <select
                        value={selected.rateCardId}
                        onChange={(e) => {
                          const res = assignAgentRateCard(selected.id, e.target.value);
                          if (!res.ok) toast.error(res.error);
                          else
                            toast.success("Rate card assigned", {
                              description: rateCardById(rateCards, e.target.value)?.name,
                            });
                        }}
                        className="hos-cell rounded-lg px-2 py-2 text-xs"
                      >
                        {activeCards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} · {c.name} · {c.kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[var(--hos-line)] bg-[var(--hos-cell)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                            <th className="px-3 py-2">Room type</th>
                            <th className="px-3 py-2 text-right">Net / night</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--hos-line)] bg-[var(--hos-cell)]">
                          {mouRates.map((row) => (
                            <tr key={row.type.code} className="bg-[var(--hos-cell)]">
                              <td className="px-3 py-2">{row.type.name}</td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  value={row.net}
                                  onChange={(e) => {
                                    setNetRate(
                                      selected.rateCardId,
                                      row.type.code,
                                      Number(e.target.value) || 0,
                                    );
                                  }}
                                  className="hos-cell w-24 rounded-lg px-2 py-1 text-right font-mono text-xs tabular-nums"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                    <strong className="text-xs uppercase tracking-wide text-[var(--hos-ink-3)]">
                      MoU (bilateral)
                    </strong>
                    <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[11px]">
                      {mouLinks
                        .filter(
                          (l) =>
                            selected &&
                            l.agentId === selected.id &&
                            l.propertyId === DEMO_MOU_PROPERTY_ID,
                        )
                        .map((l) => (
                          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {l.status} · {l.initiatedBy} · {l.propertyName}
                            </span>
                            {l.status === "pending_counterparty" &&
                            l.initiatedBy === "agent" ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  const res = decideMou(l.id, "active", "GM · Desk");
                                  if (!res.ok) toast.error(res.error);
                                  else toast.success("MoU activated");
                                }}
                              >
                                Accept
                              </Button>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 !rounded-full"
                      disabled={!selected}
                      onClick={() => {
                        if (!selected) return;
                        const res = proposeMou({
                          propertyId: DEMO_MOU_PROPERTY_ID,
                          propertyName: "Demo Hotel",
                          agentId: selected.id,
                          initiatedBy: "hotel",
                          actor: "GM · Desk",
                          creditLimitBtn: selected.creditLimit,
                        });
                        if (!res.ok) toast.error(res.error);
                        else toast.success("MoU proposed to agent");
                      }}
                    >
                      Propose MoU
                    </Button>
                  </div>

                  <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                    <strong className="text-xs uppercase tracking-wide text-[var(--hos-ink-3)]">
                      Partner change queue
                    </strong>
                    <div className="mt-2 space-y-2">
                      {changeRequests.filter(
                        (c) =>
                          c.status === "pending" &&
                          selected &&
                          c.agentId === selected.id,
                      ).length === 0 ? (
                        <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">No pending requests</p>
                      ) : (
                        changeRequests
                          .filter(
                            (c) =>
                              c.status === "pending" &&
                              selected &&
                              c.agentId === selected.id,
                          )
                          .map((req) => (
                            <div
                              key={req.id}
                              className="rounded-lg border border-[var(--hos-line)] p-2 text-[11px]"
                            >
                              <div className="font-semibold text-[var(--hos-ink)]">{req.summary}</div>
                              <p className="m-0 mt-0.5 text-[var(--hos-ink-3)]">{req.detail}</p>
                              <p className="m-0 mt-0.5 text-[10px] text-[var(--hos-ink-3)]">
                                By {req.submittedBy}
                                {req.stayId ? ` · stay ${req.stayId.slice(0, 8)}` : ""}
                              </p>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    void deskReviewChange(req.id, "approved").then((res) => {
                                      if (!res.ok) toast.error(res.error);
                                      else toast.success("Change approved · FO applied");
                                    });
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    void deskReviewChange(req.id, "rejected").then((res) => {
                                      if (!res.ok) toast.error(res.error);
                                      else toast.success("Change rejected");
                                    });
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                    {depositSlips.filter(
                      (d) =>
                        d.status === "awaiting_desk" &&
                        selected &&
                        d.agentId === selected.id,
                    ).length ? (
                      <div className="mt-3 space-y-2 border-t border-[var(--hos-line)] pt-2">
                        <strong className="text-[10px] uppercase text-[var(--hos-ink-3)]">
                          Deposit proofs
                        </strong>
                        {depositSlips
                          .filter(
                            (d) =>
                              d.status === "awaiting_desk" &&
                              selected &&
                              d.agentId === selected.id,
                          )
                          .map((slip) => (
                            <div
                              key={slip.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--hos-line)] p-2 text-[11px]"
                            >
                              <span>
                                {formatNu(slip.amount)} · {slip.ref}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    void verifyDeposit(
                                      slip.id,
                                      "verified",
                                      selected.id,
                                    ).then((res) => {
                                      if (!res.ok) toast.error(res.error);
                                      else
                                        toast.success("Deposit verified", {
                                          description: `Credited ${selected.code}`,
                                        });
                                    });
                                  }}
                                >
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    void verifyDeposit(
                                      slip.id,
                                      "rejected",
                                      selected.id,
                                    ).then((res) => {
                                      if (!res.ok) toast.error(res.error);
                                      else toast.success("Deposit rejected");
                                    });
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                    <strong className="text-xs uppercase tracking-wide text-[var(--hos-ink-3)]">
                      Aging waterfall
                    </strong>
                    <div className="mt-2 space-y-1">
                      {(
                        [
                          ["Current", selected.aging.current, "var(--hos-primary)"],
                          ["30d", selected.aging.d30, "var(--hos-ink-2)"],
                          ["60d", selected.aging.d60, "var(--hos-brass)"],
                          ["90d+", selected.aging.d90, "var(--hos-ruby)"],
                        ] as const
                      ).map(([label, amt, color]) => {
                        const total = agingTotal(selected) || 1;
                        const w = Math.round((amt / total) * 100);
                        return (
                          <div key={label} className="flex items-center gap-2 text-[11px]">
                            <span className="w-12 text-[var(--hos-ink-3)]">{label}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)] dark:bg-[rgba(255,255,255,0.08)]">
                              <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
                            </div>
                            <span className="w-20 text-right font-mono tabular-nums">{formatNu(amt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                      <strong className="text-xs text-[var(--hos-ink)]">Book allotment</strong>
                      <input
                        type="number"
                        value={bookAmt}
                        onChange={(e) => setBookAmt(Number(e.target.value) || 0)}
                        className="mt-2 w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-sm"
                      />
                      <Button
                        className="mt-2 w-full"
                        size="sm"
                        onClick={() => {
                          start(() => {
                            const res = bookAllotment(selected.id, bookAmt);
                            if (!res.ok) toast.error(res.error);
                            else toast.success(`Allotment ${formatNu(bookAmt)} reserved on credit`);
                          });
                        }}
                      >
                        Reserve MoU block
                      </Button>
                    </div>
                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                      <strong className="text-xs text-[var(--hos-ink)]">Record payment</strong>
                      <input
                        type="number"
                        value={payAmt}
                        onChange={(e) => setPayAmt(Number(e.target.value) || 0)}
                        className="mt-2 w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-sm"
                      />
                      <Button
                        className="mt-2 w-full"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          start(() => {
                            void recordPayment(selected.id, payAmt).then((res) => {
                              if (!res.ok) toast.error(res.error);
                              else
                                toast.success(`Payment ${formatNu(payAmt)} applied`, {
                                  description: "Buckets cleared 90+ → current",
                                });
                            });
                          });
                        }}
                      >
                        Apply to aging
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <RateSheetShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        season={season}
        mealPlan={mealPlan}
        initialAudience="mou"
        initialAgentId={selected?.id}
      />

      <AgentPrintPackOverlay
        open={statementOpen}
        agent={statementAgent}
        stays={stays}
        fiscalDocs={fiscalDocs}
        onClose={() => setStatementOpen(false)}
      />
    </div>
    </ModuleFrame>
  );
}
