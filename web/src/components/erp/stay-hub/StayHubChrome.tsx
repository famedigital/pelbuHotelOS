"use client";

import { AgentNameLink } from "@/components/erp/AgentNameLink";
import { Badge } from "@/components/ui/badge";
import { StayProgressStrip } from "@/components/erp/StayProgressStrip";
import {
  statusLabel,
  stayMetaLine,
} from "@/lib/folio/stay-hub-format";
import type { StayHubStep, StayHubStepId } from "@/lib/folio/stay-hub-cycle";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function StayHubHeader({
  guestName,
  status,
  roomLabel,
  roomTypeName,
  checkIn,
  checkOut,
  bookingId,
  alerts,
  steps,
  panel,
  terminal,
  saveStatus,
  lockHint,
  onStepClick,
}: {
  guestName: string;
  status?: string | null;
  roomLabel?: string | null;
  roomTypeName?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  bookingId?: string | null;
  alerts: Array<{ key: string; label: string; tone: "warn" | "danger" | "info" }>;
  steps: StayHubStep[];
  panel: StayHubStepId;
  terminal?: string | null;
  saveStatus?: "idle" | "saving" | "saved" | "error" | null;
  lockHint?: string | null;
  onStepClick?: (id: StayHubStepId, locked: boolean, reason?: string) => void;
}) {
  return (
    <div className="shrink-0 space-y-2.5 border-b bg-card px-4 py-3 pr-12 md:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Stay hub
          </p>
          <h2 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
            {guestName.trim() || "Walk-in guest"}
          </h2>
          {checkIn && checkOut ? (
            <p className="text-xs leading-snug text-muted-foreground">
              {stayMetaLine({
                roomLabel,
                roomTypeName,
                checkIn,
                checkOut,
                bookingId,
              })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Loading stay…</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {status ? (
            <Badge
              variant={statusBadgeVariant(status)}
              className="capitalize"
            >
              {statusLabel(status)}
            </Badge>
          ) : null}
          {saveStatus && saveStatus !== "idle" ? (
            <span
              className={cn(
                "text-[10px] font-medium",
                saveStatus === "saving" && "text-muted-foreground",
                saveStatus === "saved" && "text-emerald-700 dark:text-emerald-400",
                saveStatus === "error" && "text-destructive",
              )}
              role="status"
            >
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved"
                  : "Save failed"}
            </span>
          ) : null}
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {alerts.map((a) => (
            <Badge
              key={a.key}
              variant={
                a.tone === "danger"
                  ? "destructive"
                  : a.tone === "warn"
                    ? "maroon"
                    : "secondary"
              }
              className="whitespace-nowrap"
            >
              {a.label}
            </Badge>
          ))}
        </div>
      ) : null}

      <StayProgressStrip
        steps={steps}
        activePanel={panel}
        terminal={terminal}
        onStepClick={onStepClick}
      />
      {lockHint ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          {lockHint}
        </p>
      ) : null}
    </div>
  );
}

function statusBadgeVariant(
  status: string,
): "secondary" | "sky" | "citrus" | "gold" | "maroon" {
  if (status === "checked_in") return "citrus";
  if (status === "confirmed") return "sky";
  if (status === "held" || status === "pending") return "gold";
  if (status === "cancelled" || status === "no_show") return "maroon";
  return "secondary";
}

export function StayHubSummaryCard({
  balanceDue,
  agentId,
  agentName,
  paymentMode,
  nextAction,
  folioId,
  roomLabel,
  roomTypeName,
}: {
  balanceDue: number;
  agentId?: string | null;
  agentName?: string | null;
  paymentMode?: string | null;
  nextAction: string;
  folioId: string | null;
  roomLabel?: string | null;
  roomTypeName?: string | null;
}) {
  const clear = Math.abs(balanceDue) <= 0.5;
  return (
    <aside className="mb-4 space-y-2 md:mb-0 md:sticky md:top-0">
      <div className="rounded-xl border bg-card p-3.5 shadow-sm">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Balance due
        </p>
        <p
          className={cn(
            "mt-1 text-xl font-semibold tracking-tight tabular-nums",
            !clear && "text-maroon",
          )}
        >
          {clear
            ? "Clear"
            : `Nu ${Math.round(balanceDue).toLocaleString()}`}
        </p>
        {agentName || agentId ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Agent ·{" "}
            <AgentNameLink
              agentId={agentId}
              name={agentName}
              className="text-xs"
              tab="money"
            />
          </p>
        ) : null}
        {paymentMode ? (
          <p className="text-xs text-muted-foreground capitalize">
            Mode · {paymentMode.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border bg-card p-3.5 shadow-sm">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Room
        </p>
        <p className="mt-1 text-sm font-medium">
          {roomLabel?.trim() || "Unassigned"}
        </p>
        {roomTypeName ? (
          <p className="text-xs text-muted-foreground">{roomTypeName}</p>
        ) : null}
      </div>
      <div className="rounded-xl border bg-card p-3.5 shadow-sm">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Next
        </p>
        <p className="mt-1 text-sm leading-snug">{nextAction}</p>
        {folioId ? (
          <a
            href={`/erp/folios/${folioId}`}
            className="mt-2 inline-block text-xs font-medium text-accent underline-offset-4 hover:underline"
          >
            Open folio →
          </a>
        ) : null}
      </div>
    </aside>
  );
}

export function StayHubWorkFrame({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function StayHubFooterBar({
  panelLabel,
  primaryCta,
  onClose,
}: {
  panelLabel: string;
  primaryCta?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5">
      <p className="text-xs font-medium text-muted-foreground">{panelLabel}</p>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex-none"
        >
          Close
        </button>
        {primaryCta}
      </div>
    </div>
  );
}
