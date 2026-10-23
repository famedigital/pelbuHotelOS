import { StatusPill } from "@/components/erp/DeskListShell";
import { Button } from "@/components/ui/button";
import type {
  AgentCockpitCheck,
  AgentCockpitJob,
  AgentCockpitReport,
} from "@/lib/erp/agent-cockpit";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type AgentAccountProfile = {
  status: string;
  market: string;
  dzongkhag: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  rateTier: string;
  creditUsed: number;
  creditLimit: number;
  from: string;
  to: string;
  bookingCount: number;
  roomNights: number;
  quotedTotal: number;
  habit: string;
};

function rateSheetLabel(tier: string): string {
  switch (tier) {
    case "mou_agents":
      return "Signed contract";
    case "agents":
      return "Agent rate";
    case "public":
      return "Public rate";
    case "friends":
      return "Friends rate";
    case "family":
      return "Family rate";
    case "mutual_friends":
      return "Mutual friends";
    default:
      return tier.replace(/_/g, " ");
  }
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Partner account home — who they are, what they owe, what the desk should do.
 */
export function AgentCockpitBoard({
  agentId,
  profile,
  doJobs,
  reports,
  checks,
}: {
  propertyId?: string;
  agentId: string;
  companyName?: string;
  briefing?: string;
  profile: AgentAccountProfile;
  doJobs: AgentCockpitJob[];
  reports: AgentCockpitReport[];
  checks: AgentCockpitCheck[];
}) {
  const base = `/erp/agents/${agentId}`;
  const range = `from=${profile.from}&to=${profile.to}`;
  const outstanding = reports.find((row) => row.label === "Outstanding");
  const credit = reports.find((row) => row.label === "Credit available");
  const rooms = reports.find((row) => row.label === "Open rooms");
  const creditPct =
    profile.creditLimit > 0
      ? Math.min(100, Math.round((profile.creditUsed / profile.creditLimit) * 100))
      : 0;
  const place = [profile.market, profile.dzongkhag].filter(Boolean).join(" · ");

  const figures = [
    {
      label: "They owe",
      value: outstanding?.value ?? formatBtn(0),
      hint: "Open room and food bills",
      warn: outstanding?.warn,
      href: `${base}?tab=money&${range}`,
    },
    {
      label: "Credit left",
      value: credit?.value ?? formatBtn(0),
      hint: `${formatBtn(profile.creditUsed)} used of ${formatBtn(profile.creditLimit)}`,
      warn: credit?.warn,
      href: "#agent-desk-ops",
      bar: creditPct,
    },
    {
      label: "Rooms in house",
      value: rooms?.value ?? "0",
      hint: "Rooms staying now, against the cap",
      warn: rooms?.warn,
      href: `${base}?tab=bookings&${range}`,
    },
    {
      label: "This period",
      value: String(profile.bookingCount),
      hint: `${profile.roomNights} room-nights · ${formatBtn(profile.quotedTotal)} quoted`,
      href: `${base}?tab=bookings&${range}`,
    },
  ];

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={profile.status} />
            <span className="text-sm text-muted-foreground">{place || "Travel partner"}</span>
          </div>
          <p className="text-sm text-foreground">
            {profile.contactName?.trim() || "No contact name"}
            {profile.contactPhone ? (
              <>
                {" · "}
                <a className="underline-offset-4 hover:underline" href={`tel:${profile.contactPhone}`}>
                  {profile.contactPhone}
                </a>
              </>
            ) : null}
            {profile.contactEmail ? (
              <>
                {" · "}
                <a className="underline-offset-4 hover:underline" href={`mailto:${profile.contactEmail}`}>
                  {profile.contactEmail}
                </a>
              </>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">
            Rate on the book: {rateSheetLabel(profile.rateTier)}
            <span className="mx-2 text-border">·</span>
            {shortDate(profile.from)} – {shortDate(profile.to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/erp/reserve">New reservation</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`${base}?tab=money&${range}`}>Money</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/erp/rates">Rate book</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 border-y lg:grid-cols-4">
        {figures.map((figure) => (
          <Link
            key={figure.label}
            href={figure.href}
            className="border-border px-5 py-4 transition-colors hover:bg-secondary/40 max-lg:[&:nth-child(-n+2)]:border-b [&:nth-child(odd)]:border-r lg:border-r lg:border-b-0 lg:last:border-r-0"
          >
            <p className="text-xs text-muted-foreground">{figure.label}</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
                figure.warn && "text-destructive",
              )}
            >
              {figure.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{figure.hint}</p>
            {figure.bar != null ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", figure.warn ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${figure.bar}%` }}
                />
              </div>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)]">
        <div className="px-5 py-4 lg:border-r">
          <h2 className="text-sm font-medium">Needs attention</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Arrivals, balances, and food bills for this company.
          </p>
          {doJobs.length === 0 ? (
            <p className="mt-4 rounded-lg bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
              Nothing waiting. New arrivals and unpaid bills show up here.
            </p>
          ) : (
            <ul className="mt-3 divide-y rounded-lg border">
              {doJobs.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.why}</p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link
                      href={
                        job.href.startsWith("?") || job.href.startsWith("#")
                          ? `${base}${job.href}`
                          : job.href
                      }
                    >
                      {job.cta}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <h2 className="text-sm font-medium">How they pay</h2>
            <p className="mt-1 text-sm text-muted-foreground">{profile.habit}</p>
          </div>
          {checks.length > 0 ? (
            <div>
              <h2 className="text-sm font-medium">Watch</h2>
              <ul className="mt-2 space-y-2">
                {checks.map((check) => {
                  const href = check.href
                    ? check.href.startsWith("?") || check.href.startsWith("#")
                      ? `${base}${check.href}`
                      : check.href
                    : null;
                  const body = (
                    <>
                      <span className="font-medium">{check.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{check.hint}</span>
                    </>
                  );
                  return (
                    <li key={check.id}>
                      {href ? (
                        <Link href={href} className="block rounded-lg border px-3 py-2 text-sm hover:bg-secondary/50">
                          {body}
                        </Link>
                      ) : (
                        <div className="rounded-lg border px-3 py-2 text-sm">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <Link className="underline-offset-4 hover:underline" href={`${base}?tab=bookings&${range}`}>
              Bookings
            </Link>
            <Link className="underline-offset-4 hover:underline" href={`${base}?tab=guests&${range}`}>
              Guests
            </Link>
            <Link className="underline-offset-4 hover:underline" href={`${base}?tab=rooms&${range}`}>
              Rooms
            </Link>
            <Link className="underline-offset-4 hover:underline" href={`${base}?tab=rates&${range}`}>
              Rates
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
