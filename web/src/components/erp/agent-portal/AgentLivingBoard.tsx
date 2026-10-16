"use client";

import {
  AgentStatusPill,
  bookingStatusTone,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AgentLivingDashboard } from "@/lib/agent-portal-dashboard";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  BedDoubleIcon,
  FileTextIcon,
  LogOutIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";

function MetricTile({
  label,
  value,
  href,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  href: string;
  tone?: "default" | "warn" | "ok" | "accent";
  icon: typeof BedDoubleIcon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-2xl border p-4 transition-colors hover:bg-muted/40",
        tone === "accent" && "border-sky-300/70 bg-sky-50/70",
        tone === "warn" && "border-amber-400/50 bg-amber-50/60",
        tone === "ok" && "border-emerald-300/50 bg-emerald-50/50",
        tone === "default" && "border-border/80 bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </p>
        <Icon className="size-4 text-muted-foreground opacity-70" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-800 opacity-0 transition-opacity group-hover:opacity-100">
        Open <ArrowRightIcon className="size-3" />
      </p>
    </Link>
  );
}

function StayMiniList({
  rows,
  empty,
}: {
  rows: AgentLivingDashboard["stays"];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-xl border border-border/80 bg-card">
      {rows.slice(0, 8).map((s) => (
        <li
          key={s.id}
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
        >
          <div className="min-w-0">
            <Link
              href={`/agents/app/stays/${s.id}`}
              className="text-sm font-semibold text-sky-900 underline-offset-4 hover:underline"
            >
              {s.guestName ?? s.confirmationLabel}
            </Link>
            <p className="text-xs text-muted-foreground">
              {s.confirmationLabel} · {s.checkIn} → {s.checkOut}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AgentStatusPill tone={bookingStatusTone(s.status)}>
              {s.status.replace(/_/g, " ")}
            </AgentStatusPill>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                Math.abs(s.dueBtn) > 0.5 && "text-destructive",
              )}
            >
              {formatBtn(s.dueBtn)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Living partner dashboard — Do / Report / Check + lane tabs (premium shadcn). */
export function AgentLivingBoard({
  dash,
  companyName,
}: {
  dash: AgentLivingDashboard;
  companyName: string;
}) {
  const m = dash.metrics;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 shadow-none">
        <div className="bg-gradient-to-br from-sky-50 via-background to-amber-50/30">
          <CardHeader className="pb-3 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-sky-700 uppercase">
                  Living dashboard
                </p>
                <CardTitle className="text-xl tracking-tight">
                  {companyName}
                </CardTitle>
                <CardDescription className="mt-1 max-w-xl text-sm text-foreground/80">
                  {dash.briefing}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {dash.today}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pb-5">
            <Button asChild size="sm" className="h-9">
              <Link href="/agents/app/book">Hold rooms</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-9">
              <Link href="/agents/app/stays">All stays</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-9">
              <Link href="/agents/app/guests">Registrations</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-9">
              <Link href="/agents/app/payments">Payments</Link>
            </Button>
          </CardContent>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Arrivals today"
          value={String(m.arrivalsToday)}
          href="/agents/app/guests"
          icon={UserRoundIcon}
          tone={m.arrivalsToday ? "accent" : "default"}
        />
        <MetricTile
          label="Checkouts today"
          value={String(m.checkoutsToday)}
          href="/agents/app/checkouts"
          icon={LogOutIcon}
          tone={m.unpaidCheckouts ? "warn" : "default"}
        />
        <MetricTile
          label="In-house"
          value={String(m.inHouse)}
          href="/agents/app/stays"
          icon={BedDoubleIcon}
          tone="ok"
        />
        <MetricTile
          label="Open due"
          value={formatBtn(m.openDueBtn)}
          href="/agents/app/money"
          icon={WalletIcon}
          tone={Math.abs(m.openDueBtn) > 0.5 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Do</CardTitle>
            <CardDescription>
              Ranked work for your guests at this hotel
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dash.doJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing waiting — check Report for invoices & payments.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {dash.doJobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {job.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{job.why}</p>
                    </div>
                    <Button asChild size="sm" className="h-9 min-w-[6.5rem]">
                      <Link href={job.href}>{job.cta}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Report</CardTitle>
              <CardDescription>Jump to a living lane</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {dash.reports.map((r) => (
                <Link
                  key={r.label}
                  href={r.href}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      r.warn ? "text-amber-800" : "text-foreground",
                    )}
                  >
                    {r.value}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Check</CardTitle>
              <CardDescription>Verify before trouble</CardDescription>
            </CardHeader>
            <CardContent>
              {dash.checks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No flags — holds and dues look healthy.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dash.checks.map((c) => (
                    <li key={c.id}>
                      {c.href ? (
                        <Link
                          href={c.href}
                          className="block rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                        >
                          <span className="font-medium">{c.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {c.hint}
                          </span>
                        </Link>
                      ) : (
                        <div className="rounded-lg border px-3 py-2 text-sm">
                          <span className="font-medium">{c.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {c.hint}
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="opacity-40" />

      <Tabs defaultValue="arrivals" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="arrivals" className="text-xs sm:text-sm">
            Arrivals
          </TabsTrigger>
          <TabsTrigger value="inhouse" className="text-xs sm:text-sm">
            In-house
          </TabsTrigger>
          <TabsTrigger value="checkouts" className="text-xs sm:text-sm">
            Checkouts
          </TabsTrigger>
          <TabsTrigger value="holds" className="text-xs sm:text-sm">
            Holds
          </TabsTrigger>
          <TabsTrigger value="money" className="text-xs sm:text-sm">
            Invoices & pay
          </TabsTrigger>
        </TabsList>

        <TabsContent value="arrivals" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Today & next 7 days</p>
            <Button asChild variant="ghost" size="sm">
              <Link href="/agents/app/guests">Guest register →</Link>
            </Button>
          </div>
          <StayMiniList
            rows={[...dash.arrivalsToday, ...dash.arrivalsSoon]}
            empty="No upcoming arrivals."
          />
        </TabsContent>

        <TabsContent value="inhouse" className="space-y-3">
          <StayMiniList rows={dash.inHouse} empty="No guests in-house." />
        </TabsContent>

        <TabsContent value="checkouts" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Due-out & recent departures</p>
            <Button asChild variant="ghost" size="sm">
              <Link href="/agents/app/checkouts">Full checkouts →</Link>
            </Button>
          </div>
          <StayMiniList
            rows={[...dash.checkoutsToday, ...dash.recentCheckouts]}
            empty="No checkouts in view."
          />
        </TabsContent>

        <TabsContent value="holds" className="space-y-3">
          <StayMiniList
            rows={dash.openHolds}
            empty="No open holds — book rooms when you need inventory."
          />
        </TabsContent>

        <TabsContent value="money" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileTextIcon className="size-4" />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dash.invoices.slice(0, 5).map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/agents/app/invoices/${inv.id}`}
                    className="flex justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <span className="font-mono font-medium">{inv.docNo}</span>
                    <span className="tabular-nums">
                      {inv.totalBtn == null ? "—" : formatBtn(inv.totalBtn)}
                    </span>
                  </Link>
                ))}
                {dash.invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No INV/RCP yet.
                  </p>
                ) : null}
                <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                  <Link href="/agents/app/invoices">All invoices</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <WalletIcon className="size-4" />
                  Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dash.payments.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>
                      {p.paidAt.slice(0, 10)} · {p.method}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatBtn(p.amountBtn)}
                    </span>
                  </div>
                ))}
                {dash.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No payments recorded.
                  </p>
                ) : null}
                <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                  <Link href="/agents/app/payments">All payments</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
