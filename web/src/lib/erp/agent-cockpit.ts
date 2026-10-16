import type { AgentDossier } from "@/lib/reports/agent-dossier";
import { recommendStayHubStep } from "@/lib/folio/stay-hub-cycle";
import { formatBtn } from "@/lib/pricing";

export type AgentCockpitJobKind =
  | "collect"
  | "check_in"
  | "checkout"
  | "confirm"
  | "approve"
  | "credit"
  | "fnb";

export type AgentCockpitJob = {
  id: string;
  kind: AgentCockpitJobKind;
  rank: number;
  title: string;
  why: string;
  cta: string;
  href: string;
};

export type AgentCockpitReport = {
  label: string;
  value: string;
  href: string;
  warn?: boolean;
};

export type AgentCockpitCheck = {
  id: string;
  title: string;
  hint: string;
  href?: string;
};

function hubHref(
  bookingId: string,
  status: string,
  checkIn: string,
  checkOut: string,
  today: string,
): string {
  const step = recommendStayHubStep({
    status,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    openBusinessDate: today,
    board: "auto",
  });
  return `/erp/stayview?booking=${encodeURIComponent(bookingId)}&step=${step}`;
}

/** Ranked Do jobs + Report chips + Check rows for one agent. */
export function buildAgentCockpit(dossier: AgentDossier): {
  briefing: string;
  doJobs: AgentCockpitJob[];
  reports: AgentCockpitReport[];
  checks: AgentCockpitCheck[];
} {
  const { agent, money, today, bookings } = dossier;
  const jobs: AgentCockpitJob[] = [];

  if (agent.status === "pending") {
    jobs.push({
      id: "approve",
      kind: "approve",
      rank: 1,
      title: "Approve partner",
      why: "Still pending — unlock rates & credit",
      cta: "Review",
      href: `#agent-desk-ops`,
    });
  }

  for (const b of bookings) {
    const st = b.status.toLowerCase();
    if (
      (st === "confirmed" || st === "held" || st === "pending") &&
      b.check_in <= today
    ) {
      jobs.push({
        id: `ci-${b.id}`,
        kind: "check_in",
        rank: 2,
        title: b.contact_name ?? "Guest",
        why: `Arrival ${b.check_in} — check in`,
        cta: "Check-in",
        href: hubHref(b.id, b.status, b.check_in, b.check_out, today),
      });
    }
    if (st === "checked_in" && Math.abs(b.balance_btn) > 0.5) {
      const dueOut = b.check_out <= today;
      jobs.push({
        id: `pay-${b.id}`,
        kind: dueOut ? "checkout" : "collect",
        rank: dueOut ? 2 : 3,
        title: b.contact_name ?? "Guest",
        why: dueOut
          ? `Due-out · Due ${formatBtn(b.balance_btn)}`
          : `In-house · Due ${formatBtn(b.balance_btn)}`,
        cta: dueOut ? "Collect / out" : "Collect",
        href: hubHref(b.id, b.status, b.check_in, b.check_out, today),
      });
    } else if (
      st === "checked_in" &&
      b.check_out <= today &&
      Math.abs(b.balance_btn) <= 0.5
    ) {
      jobs.push({
        id: `co-${b.id}`,
        kind: "checkout",
        rank: 3,
        title: b.contact_name ?? "Guest",
        why: "Due Clear — confirm leave",
        cta: "Check out",
        href: `/erp/stayview?booking=${encodeURIComponent(b.id)}&step=check_out`,
      });
    }
  }

  for (const item of money.openItems) {
    if (Math.abs(item.balance) <= 0.5) continue;
    jobs.push({
      id: `fnb-${item.folioId}`,
      kind: "fnb",
      rank: 4,
      title: item.label,
      why: `F&B open · ${formatBtn(item.balance)}`,
      cta: "Collect",
      href: `/erp/folios/${item.folioId}?advanced=1`,
    });
  }

  const available = Math.max(0, agent.credit_limit - agent.credit_used);
  if (agent.credit_used > agent.credit_limit + 0.5) {
    jobs.push({
      id: "over-credit",
      kind: "credit",
      rank: 1,
      title: "Over credit limit",
      why: `Used ${formatBtn(agent.credit_used)} / limit ${formatBtn(agent.credit_limit)}`,
      cta: "Money",
      href: `#agent-desk-ops`,
    });
  }

  jobs.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
  const doJobs = jobs.slice(0, 20);

  const reports: AgentCockpitReport[] = [
    {
      label: "Outstanding",
      value: formatBtn(money.outstanding),
      href: `?tab=money`,
      warn: Math.abs(money.outstanding) > 0.5,
    },
    {
      label: "Credit available",
      value: formatBtn(available),
      href: `#agent-desk-ops`,
      warn: available < 1 && agent.credit_limit > 0,
    },
    {
      label: "Open rooms",
      value: `${money.openRoomsInHouse} / ${agent.open_room_cap}`,
      href: `?tab=bookings`,
      warn: money.openRoomsInHouse >= agent.open_room_cap,
    },
    {
      label: "Settlement packs",
      value: String(money.packs.length),
      href: `?tab=money`,
    },
  ];

  const checks: AgentCockpitCheck[] = [];
  if (agent.status === "pending") {
    checks.push({
      id: "pending",
      title: "Partner not approved",
      hint: "Approve before quoting Agents tier",
      href: "#agent-desk-ops",
    });
  }
  if (money.openRoomsInHouse >= agent.open_room_cap) {
    checks.push({
      id: "cap",
      title: "Room cap full",
      hint: `${money.openRoomsInHouse} in-house vs cap ${agent.open_room_cap}`,
      href: "?tab=bookings",
    });
  }
  if (money.aging.d90 > 0.5) {
    checks.push({
      id: "aging",
      title: "90+ day AR",
      hint: formatBtn(money.aging.d90),
      href: "?tab=money",
    });
  }
  if (!agent.contact_phone && !agent.contact_email) {
    checks.push({
      id: "contact",
      title: "No phone or email",
      hint: "Hard to chase collections",
      href: "#agent-desk-ops",
    });
  }

  const parts: string[] = [];
  if (doJobs.length) parts.push(`${doJobs.length} job${doJobs.length === 1 ? "" : "s"}`);
  if (Math.abs(money.outstanding) > 0.5) {
    parts.push(`owes ${formatBtn(money.outstanding)}`);
  }
  if (money.openRoomsInHouse) {
    parts.push(`${money.openRoomsInHouse} room${money.openRoomsInHouse === 1 ? "" : "s"} in-house`);
  }
  const briefing =
    parts.length > 0
      ? parts.join(" · ")
      : `Quiet for ${agent.company_name} · ${money.habit.blurb}`;

  return { briefing, doJobs, reports, checks };
}

export function agentHubBookingHref(
  bookingId: string,
  status: string,
  checkIn: string,
  checkOut: string,
  today: string,
): string {
  return hubHref(bookingId, status, checkIn, checkOut, today);
}
