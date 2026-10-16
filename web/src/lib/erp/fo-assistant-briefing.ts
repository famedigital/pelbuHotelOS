import type { DailyDeskSnapshot } from "@/lib/erp/daily-desk";
import type { FoNextKind } from "@/lib/erp/fo-next-action";

/** Aggregates for UI + Gemini (no full folio dump). */
export type FoAssistantBriefingInput = {
  businessDate: string;
  wallToday: string;
  nightAuditStale: boolean;
  doCount: number;
  arrivals: number;
  departures: number;
  inHouse: number;
  agentUnpaid: number;
  missingGuides: number;
  dueOutUnpaid: number;
  doKinds: Partial<Record<FoNextKind, number>>;
};

export function foAssistantBriefingInput(
  snap: DailyDeskSnapshot,
): FoAssistantBriefingInput {
  const doKinds: Partial<Record<FoNextKind, number>> = {};
  for (const a of snap.actions.slice(0, 40)) {
    doKinds[a.kind] = (doKinds[a.kind] ?? 0) + 1;
  }
  const dueOutUnpaid = snap.dayOps.departures.filter(
    (r) => Math.abs(Number(r.folio_balance_btn ?? 0)) > 0.5,
  ).length;
  return {
    businessDate: snap.businessDate,
    wallToday: snap.wallToday,
    nightAuditStale: snap.nightAuditStale,
    doCount: snap.actions.length,
    arrivals: snap.dayOps.arrivals.length,
    departures: snap.dayOps.departures.length,
    inHouse: snap.dayOps.inHouse.length,
    agentUnpaid: snap.agentUnpaidCount,
    missingGuides: snap.missingGuideScans.length,
    dueOutUnpaid,
    doKinds,
  };
}

/** Instant class-8 line — never waits on Gemini. */
export function buildDeterministicFoBriefing(
  input: FoAssistantBriefingInput,
): string {
  const parts: string[] = [];
  if (input.nightAuditStale) {
    parts.push("Close yesterday (Night close) before new check-ins");
  }
  if (input.doCount > 0) {
    parts.push(`${input.doCount} job${input.doCount === 1 ? "" : "s"} waiting`);
  }
  if (input.arrivals > 0) {
    parts.push(`${input.arrivals} arrival${input.arrivals === 1 ? "" : "s"}`);
  }
  if (input.departures > 0) {
    parts.push(
      `${input.departures} due-out${input.departures === 1 ? "" : "s"}`,
    );
  }
  if (input.dueOutUnpaid > 0) {
    parts.push(`${input.dueOutUnpaid} due-out still owe`);
  }
  if (input.agentUnpaid > 0) {
    parts.push(`${input.agentUnpaid} agent pay follow-up`);
  }
  if (input.missingGuides > 0) {
    parts.push(`${input.missingGuides} missing guide`);
  }
  if (parts.length === 0) {
    return `Quiet shift · ${input.inHouse} in-house · working date ${input.businessDate}`;
  }
  return parts.join(" · ");
}

export function capDoActions<T>(actions: T[], max = 20): T[] {
  return actions.slice(0, max);
}
