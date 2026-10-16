"use client";

import { AgentDueAssist } from "@/components/erp/AgentDueAssist";
import { StayViewAssistStrip } from "@/components/erp/StayViewAssistStrip";
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
import type {
  AgentCockpitCheck,
  AgentCockpitJob,
  AgentCockpitReport,
} from "@/lib/erp/agent-cockpit";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

type AssistKind = "paste" | "due" | null;

/**
 * Living agent cockpit — Do / Report / Check (premium shadcn).
 * Money Confirm stays human; Assist is optional paste-to-stay / explain due.
 */
export function AgentCockpitBoard({
  propertyId,
  agentId,
  companyName,
  briefing,
  doJobs,
  reports,
  checks,
}: {
  propertyId: string;
  agentId: string;
  companyName: string;
  briefing: string;
  doJobs: AgentCockpitJob[];
  reports: AgentCockpitReport[];
  checks: AgentCockpitCheck[];
}) {
  const [assist, setAssist] = useState<AssistKind>(null);
  const base = `/erp/agents/${agentId}`;

  function toggleAssist(kind: Exclude<AssistKind, null>) {
    setAssist((cur) => (cur === kind ? null : kind));
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2 pt-4">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Agent cockpit
          </p>
          <CardTitle className="text-lg">{companyName}</CardTitle>
          <CardDescription className="text-sm text-foreground">
            {briefing}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pb-4">
          <Badge variant="secondary" className="tabular-nums">
            Do {doJobs.length}
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            Check {checks.length}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => toggleAssist("paste")}
          >
            {assist === "paste" ? "Hide paste" : "Paste booking message"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => toggleAssist("due")}
          >
            {assist === "due" ? "Hide due" : "Explain partner due"}
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href={`${base}?tab=money`}>Money</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href="/erp/rates">Rates sheet</Link>
          </Button>
        </CardContent>
      </Card>

      {assist === "paste" ? (
        <StayViewAssistStrip propertyId={propertyId} />
      ) : null}
      {assist === "due" ? (
        <AgentDueAssist propertyId={propertyId} agentId={agentId} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Do</CardTitle>
            <CardDescription>What to do for this partner — opens Hub</CardDescription>
          </CardHeader>
          <CardContent>
            {doJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing waiting — check Report for AR & packs.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {doJobs.map((job) => (
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
                    <Button asChild size="sm" className="h-9 min-w-[7rem]">
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
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Report</CardTitle>
              <CardDescription>Tell · print · chase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.map((r) => (
                <Link
                  key={r.label}
                  href={
                    r.href.startsWith("?") || r.href.startsWith("#")
                      ? `${base}${r.href}`
                      : r.href
                  }
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      r.warn ? "text-destructive" : "text-foreground",
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
              {checks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No flags — keep credit & room cap healthy.
                </p>
              ) : (
                <ul className="space-y-2">
                  {checks.map((c) => (
                    <li key={c.id}>
                      {c.href ? (
                        <Link
                          href={
                            c.href.startsWith("?") || c.href.startsWith("#")
                              ? `${base}${c.href}`
                              : c.href
                          }
                          className="block rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                        >
                          <span className="font-medium">{c.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {c.hint}
                          </span>
                        </Link>
                      ) : (
                        <div className="rounded-md border px-3 py-2 text-sm">
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

      <Separator className="opacity-50" />
    </div>
  );
}
