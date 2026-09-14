"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  SETTINGS_DIRECTORY,
  searchSettingsIndex,
  type SettingsReadiness,
  type SettingsTabKey,
} from "@/lib/erp/settings-readiness";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function tabHref(tab: SettingsTabKey | "setup", propertyId: string): string {
  if (tab === "setup") return `/erp/properties/${propertyId}/setup`;
  if (tab === "overview") return "/erp/settings";
  return `/erp/settings?tab=${tab}`;
}

export function SettingsHub({
  propertyId,
  readiness,
  isOwner,
}: {
  propertyId: string;
  readiness: SettingsReadiness;
  isOwner: boolean;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSettingsIndex(query), [query]);
  const showSearch = query.trim().length > 0;

  const directory = SETTINGS_DIRECTORY.filter(
    (tile) => tile.tab !== "danger" || isOwner,
  );

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="max-w-xl space-y-2">
        <label htmlFor="settings-search" className="sr-only">
          Search settings
        </label>
        <Input
          id="settings-search"
          type="search"
          placeholder="Search settings — logo, Wi‑Fi, GST, rooms…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11"
          autoComplete="off"
        />
        {showSearch ? (
          <ul className="rounded-xl border bg-card divide-y">
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                No matching settings. Try “wifi”, “logo”, or “gst”.
              </li>
            ) : (
              results.map((entry) => (
                <li key={entry.tab + entry.label}>
                  <Link
                    href={tabHref(entry.tab, propertyId)}
                    className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {entry.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.blurb}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {/* Mode-specific strip */}
      {!readiness.isMature ? (
        <SetupModeStrip propertyId={propertyId} readiness={readiness} />
      ) : (
        <MatureModeStrip readiness={readiness} propertyId={propertyId} />
      )}

      {/* Directory */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Browse sections
          </h2>
          <p className="text-sm text-muted-foreground">
            Jump to a place name — room rates and website live outside Settings.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {directory.map((tile) => (
            <li key={tile.tab}>
              <Link
                href={tabHref(tile.tab, propertyId)}
                className="flex h-full flex-col gap-1 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:border-accent/40 hover:bg-muted/30"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {tile.group}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {tile.label}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {tile.blurb}
                </span>
              </Link>
            </li>
          ))}
          {isOwner ? (
            <li>
              <Link
                href={tabHref("danger", propertyId)}
                className="flex h-full flex-col gap-1 rounded-xl border border-destructive/25 bg-card px-4 py-3.5 transition-colors hover:bg-destructive/5"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Owner
                </span>
                <span className="text-sm font-medium text-destructive">
                  Danger zone
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  Wipe operational data
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      {/* Quick exits */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Quick links
        </h2>
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/erp/rates">Room rates →</QuickLink>
          <QuickLink href="/erp/front-public">Website CMS →</QuickLink>
          <QuickLink href="/erp/training">Training →</QuickLink>
          <QuickLink href={`/erp/properties/${propertyId}/setup`}>
            Setup wizard →
          </QuickLink>
        </div>
      </section>
    </div>
  );
}

function QuickLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
    >
      {children}
    </Link>
  );
}

function SetupModeStrip({
  propertyId,
  readiness,
}: {
  propertyId: string;
  readiness: SettingsReadiness;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border bg-card px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Setup
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Finish hotel basics
            </h2>
            <p className="text-sm text-muted-foreground">
              {readiness.doneCount} of {readiness.totalCount} ready
            </p>
          </div>
          <Link
            href={`/erp/properties/${propertyId}/setup`}
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Open setup wizard
          </Link>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={readiness.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${readiness.progressPct}%` }}
          />
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {readiness.checks.map((check) => (
            <li key={check.id}>
              <Link
                href={tabHref(check.tab, propertyId)}
                className={cn(
                  "inline-flex h-8 items-center rounded-md border px-2.5 text-xs transition-colors",
                  check.done
                    ? "border-emerald-500/30 bg-emerald-500/[0.05] text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="mr-1.5" aria-hidden>
                  {check.done ? "✓" : "○"}
                </span>
                {check.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {readiness.nextTasks.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Do this next
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {readiness.nextTasks.map((task, i) => (
              <li key={task.id}>
                <Link
                  href={tabHref(task.tab, propertyId)}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {task.task}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {task.label}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-accent">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MatureModeStrip({
  readiness,
  propertyId,
}: {
  readiness: SettingsReadiness;
  propertyId: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{readiness.healthLine}</p>
      {readiness.regressions.length > 0 ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.04] px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            Needs attention
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {readiness.regressions.map((item) => (
              <li key={item.id}>
                <Link
                  href={tabHref(item.tab, propertyId)}
                  className="inline-flex h-8 items-center rounded-md border border-amber-500/30 bg-card px-2.5 text-xs text-foreground hover:bg-muted"
                >
                  {item.task}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
