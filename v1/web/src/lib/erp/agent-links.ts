import type { AgentDossierTab } from "@/lib/reports/agent-dossier";

function addMonths(isoDay: string, months: number): string {
  const d = new Date(`${isoDay.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function monthStartOf(isoDay: string): string {
  return `${isoDay.slice(0, 7)}-01`;
}

function lastDayOfMonthContaining(isoDay: string): string {
  const nextStart = addMonths(monthStartOf(isoDay), 1);
  const d = new Date(`${nextStart}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Shared agent dossier deep-link (same hub as /erp/agents/[id]). */
export function agentDossierHref(
  agentId: string,
  opts?: {
    tab?: AgentDossierTab;
    from?: string;
    to?: string;
    status?: string;
  },
): string {
  const qs = new URLSearchParams();
  if (opts?.tab && opts.tab !== "overview") qs.set("tab", opts.tab);
  if (opts?.from) qs.set("from", opts.from);
  if (opts?.to) qs.set("to", opts.to);
  if (opts?.status) qs.set("status", opts.status);
  const q = qs.toString();
  return q ? `/erp/agents/${agentId}?${q}` : `/erp/agents/${agentId}`;
}

/** Month range shortcuts for the agent dossier filter bar. */
export function agentDossierMonthPresets(today: string): Array<{
  id: string;
  label: string;
  from: string;
  to: string;
}> {
  const thisFrom = monthStartOf(today);
  const thisTo = today;
  const lastMonthDay = addMonths(thisFrom, -1);
  const lastFrom = monthStartOf(lastMonthDay);
  const lastTo = lastDayOfMonthContaining(lastMonthDay);
  const nextEnd = lastDayOfMonthContaining(addMonths(thisFrom, 2));
  const yStart = `${today.slice(0, 4)}-01-01`;
  return [
    { id: "this", label: "This month", from: thisFrom, to: thisTo },
    { id: "last", label: "Last month", from: lastFrom, to: lastTo },
    { id: "3m", label: "Next 3 months", from: thisFrom, to: nextEnd },
    { id: "ytd", label: "Year to date", from: yStart, to: thisTo },
  ];
}
