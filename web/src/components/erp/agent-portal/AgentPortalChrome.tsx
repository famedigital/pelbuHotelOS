import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

/** Shared partner-app chrome — Sky & Citrus, desk-premium motion. */

export function AgentPageHero({
  eyebrow,
  title,
  blurb,
  actions,
}: {
  eyebrow?: string;
  title: string;
  blurb?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="desk-premium-enter relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-sky-50 via-background to-amber-50/40 px-5 py-5 sm:px-6 sm:py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-sky-400/10 blur-2xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          {eyebrow ? (
            <p className="text-[11px] font-semibold tracking-[0.2em] text-sky-700 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {blurb ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {blurb}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

export function AgentMetric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "warn" | "ok";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-4 shadow-none transition-colors",
        tone === "accent" && "border-sky-300/70 bg-sky-50/80",
        tone === "warn" && "border-destructive/35 bg-destructive/5",
        tone === "ok" && "border-emerald-300/60 bg-emerald-50/70",
        tone === "default" && "border-border/80 bg-card",
      )}
    >
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function AgentSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AgentStatusPill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "ok" | "warn" | "held" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "ok" && "bg-emerald-500/15 text-emerald-800",
        tone === "warn" && "bg-amber-500/15 text-amber-900",
        tone === "held" && "bg-sky-500/15 text-sky-900",
        tone === "danger" && "bg-destructive/15 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

export function AgentPrimaryLink({
  href,
  children,
  target,
}: {
  href: string;
  children: ReactNode;
  target?: string;
}) {
  return (
    <Link
      href={href}
      target={target}
      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-95"
    >
      {children}
    </Link>
  );
}

export function AgentGhostLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-background/80 px-4 text-sm font-medium transition-colors hover:bg-muted/50"
    >
      {children}
    </Link>
  );
}

export function bookingStatusTone(
  status: string,
): "muted" | "ok" | "warn" | "held" | "danger" {
  const s = status.toLowerCase();
  if (s === "held" || s === "pending") return "held";
  if (s === "confirmed" || s === "checked_in") return "ok";
  if (s === "checked_out" || s === "settled") return "muted";
  if (s === "cancelled" || s === "expired" || s === "no_show") return "danger";
  return "warn";
}
