"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StayProgressStrip } from "@/components/erp/StayProgressStrip";
import {
  statusLabel,
  stayMetaLine,
} from "@/lib/folio/stay-hub-format";
import { foPaymentModeShort } from "@/lib/folio/fo-settlement";
import {
  type StayHubStep,
  type StayHubStepId,
} from "@/lib/folio/stay-hub-cycle";
import { isCreditAgentStatus } from "@/lib/agents/status";
import { folioNoFromConfirmation } from "@/lib/hotel-doc-no";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ChevronLeftIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type StayHubIdentityProps = {
  guestName: string;
  status?: string | null;
  roomLabel?: string | null;
  roomTypeName?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  bookingId?: string | null;
  confirmationCode?: string | null;
  agentName?: string | null;
  agentStatus?: string | null;
  paymentMode?: string | null;
  alerts: Array<{ key: string; label: string; tone: "warn" | "danger" | "info" }>;
  terminal?: string | null;
  saveStatus?: "idle" | "saving" | "saved" | "error" | null;
  lockHint?: string | null;
  /** Force multi-machine stay lease (manager). */
  onForceLock?: () => void;
  backLabel?: string | null;
  onBack?: () => void;
  dueChipBtn?: number | null;
  hkStatus?: string | null;
  /** In-house move onto a free door (view side, upgrade, or same category). */
  roomAction?: ReactNode;
};

/** Fixed left-rail amount foot (Desk Book parity) — editable nightly. */
export type StayHubRailAmount = {
  nightlyBtn: number | null;
  isCustom: boolean;
  stayTotalBtn: number | null;
  nights?: number | null;
  /** Guest rooms sold (for “1 rm · 4n” legibility). */
  rooms?: number | null;
  mealPlanCode?: string | null;
  children?: number | null;
  extraBeds?: number | null;
  pending?: boolean;
  /** FO rate pickup / sheet label (Public, Personal · Friends, …). */
  rateLabel?: string | null;
  /** Open manager PIN rate dialog / Details Rate. */
  onEdit?: () => void;
  editable?: boolean;
};

function statusBadgeVariant(
  status: string,
): "secondary" | "sky" | "citrus" | "mint" | "maroon" {
  if (status === "checked_in") return "mint";
  if (status === "confirmed") return "sky";
  if (status === "held" || status === "pending") return "citrus";
  if (status === "cancelled" || status === "no_show") return "maroon";
  return "secondary";
}

function hkChipClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "clean") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  if (s === "dirty") return "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200";
  if (s === "inspect") return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  if (s === "ooo") return "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-200";
  return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200";
}

function HkStatusChip({
  status,
}: {
  status: string | null | undefined;
}) {
  const value = status?.trim();
  if (!value) return null;
  return (
    <Link
      href="/erp/housekeeping"
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        hkChipClass(value),
      )}
      title="Housekeeping"
    >
      HK {value}
    </Link>
  );
}

/**
 * Compact stay identity. The dock is one column, so this bar is the header
 * on every width.
 */
export function StayHubHeader(props: StayHubIdentityProps) {
  const {
    guestName,
    status,
    roomLabel,
    checkIn,
    checkOut,
    confirmationCode,
    bookingId,
    alerts,
    terminal,
    saveStatus,
    lockHint,
    onForceLock,
    backLabel,
    onBack,
    dueChipBtn,
    hkStatus,
    roomAction,
  } = props;

  const showDueChip =
    dueChipBtn != null &&
    Math.abs(dueChipBtn) > 0.5 &&
    Math.abs(dueChipBtn) < 1_000_000;

  const conf =
    folioNoFromConfirmation(confirmationCode) ||
    (bookingId ? bookingId.slice(0, 8) : "");

  const noticeAlerts = alerts.filter((a) => a.key !== "dues").slice(0, 2);

  return (
    <Card className="shrink-0 gap-0 rounded-none border-x-0 border-t-0 px-3 py-1.5 pr-10 shadow-none md:hidden">
      {backLabel && onBack ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 mb-1 h-8 px-2"
        >
          <ChevronLeftIcon className="size-3.5" aria-hidden />
          {backLabel}
        </Button>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <h2 className="min-w-0 truncate text-sm font-semibold tracking-tight">
          {(guestName ?? "").trim() || "Walk-in guest"}
        </h2>
        {roomLabel ? (
          <Badge variant="sky">{roomLabel}</Badge>
        ) : (
          <Badge variant="maroon">No room</Badge>
        )}
        {showDueChip ? (
          <Badge variant="citrus" className="tabular-nums">
            Due {formatGuestBtn(dueChipBtn)}
          </Badge>
        ) : null}
        {status ? (
          <Badge variant={statusBadgeVariant(status)} className="capitalize">
            {statusLabel(status)}
          </Badge>
        ) : null}
        <HkStatusChip status={hkStatus} />
        {roomAction}
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {[
          checkIn && checkOut ? `${checkIn.slice(5)} → ${checkOut.slice(5)}` : null,
          conf || null,
        ]
          .filter(Boolean)
          .join(" · ") || "Dates loading"}
      </p>
      {saveStatus && saveStatus !== "idle" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
              ? "Saved"
              : "Save failed"}
        </p>
      ) : null}
      {noticeAlerts.map((alert) => (
        <Alert
          key={alert.key}
          variant={alert.tone === "danger" ? "destructive" : "warning"}
          className="mt-1 px-2 py-1"
        >
          <AlertDescription className="text-xs">{alert.label}</AlertDescription>
        </Alert>
      ))}
      {terminal ? (
        <Alert variant="destructive" className="mt-2 px-3 py-2">
          <AlertDescription className="text-xs capitalize">
            {terminal.replace(/_/g, " ")}
          </AlertDescription>
        </Alert>
      ) : null}
      {lockHint ? (
        <Alert variant="warning" className="mt-2 px-3 py-2">
          <AlertDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span>{lockHint}</span>
            {onForceLock ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                onClick={onForceLock}
              >
                Take over
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </Card>
  );
}

/**
 * Desktop left column: guest / agent → steps → fixed amount foot.
 */
export function StayHubLeftRail({
  identity,
  steps,
  panel,
  terminal,
  onStepClick,
  canNavigateStep,
  railActions,
  amount,
  className,
}: {
  identity: StayHubIdentityProps;
  steps: StayHubStep[];
  panel: StayHubStepId;
  terminal?: string | null;
  onStepClick?: (id: StayHubStepId, locked: boolean, reason?: string) => void;
  canNavigateStep?: (id: StayHubStepId, step: StayHubStep) => boolean;
  /** Optional compact actions under the due (e.g. open settle). */
  railActions?: ReactNode;
  /** Sticky left-bottom amount; editable when onEdit set. */
  amount?: StayHubRailAmount | null;
  className?: string;
}) {
  const {
    guestName,
    status,
    roomLabel,
    roomTypeName,
    checkIn,
    checkOut,
    bookingId,
    confirmationCode,
    agentName,
    agentStatus,
    paymentMode,
    alerts,
    saveStatus,
    lockHint,
    onForceLock,
    backLabel,
    onBack,
    dueChipBtn,
    hkStatus,
    roomAction,
  } = identity;

  const showDue =
    dueChipBtn != null &&
    Math.abs(dueChipBtn) > 0.5 &&
    Math.abs(dueChipBtn) < 1_000_000;
  const balanceClear =
    dueChipBtn != null && Math.abs(dueChipBtn) <= 0.5;

  const conf = confirmationCode?.trim();
  const creditOk =
    agentStatus != null && isCreditAgentStatus(agentStatus);
  const agentChip =
    agentStatus && agentName?.trim()
      ? creditOk
        ? "credit OK"
        : agentStatus === "directory"
          ? "TCB · directory"
          : agentStatus.replace(/_/g, " ")
      : null;

  const editable = Boolean(amount?.editable !== false && amount?.onEdit);
  const nightly = amount?.nightlyBtn;
  const stayTotal = amount?.stayTotalBtn;
  const stayNights = amount?.nights;
  const stayRooms = amount?.rooms != null ? Math.max(1, amount.rooms) : 1;
  const staySpanLabel =
    stayNights != null && stayNights > 0
      ? stayRooms > 1
        ? `${stayRooms} rm · ${stayNights}n plan`
        : `${stayNights}n plan`
      : "Stay plan";

  const amountNode = amount || showDue || balanceClear || railActions ? (
    <div className="space-y-1.5">
      {/* In-house money first — primary FO signal */}
      {showDue ? (
        <div className="rounded-md border border-amber-600/40 bg-amber-500/10 px-2 py-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Open balance
            </p>
            <p className="text-lg font-semibold tabular-nums tracking-tight text-amber-800 dark:text-amber-200">
              {formatGuestBtn(dueChipBtn)}
            </p>
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            Posted charges − payments (not full stay plan)
          </p>
          {railActions ? (
            <div className="mt-1.5 flex flex-col gap-1 [&_button]:h-8 [&_button]:min-h-8 [&_button]:w-full [&_button]:px-2 [&_button]:text-[11px]">
              {railActions}
            </div>
          ) : null}
        </div>
      ) : balanceClear ? (
        <div className="rounded-md border bg-background/80 px-2 py-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Balance
            </p>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Clear
            </p>
          </div>
          {railActions ? (
            <div className="mt-1 flex flex-col gap-1 [&_button]:h-8 [&_button]:min-h-8 [&_button]:w-full [&_button]:px-2 [&_button]:text-[11px]">
              {railActions}
            </div>
          ) : null}
        </div>
      ) : railActions && !amount ? (
        <div className="flex flex-col gap-1 [&_button]:h-8 [&_button]:min-h-8 [&_button]:w-full [&_button]:px-2 [&_button]:text-[11px]">
          {railActions}
        </div>
      ) : null}

      {amount ? (
        <button
          type="button"
          disabled={!editable}
          onClick={() => amount.onEdit?.()}
          className={cn(
            "w-full rounded-md border bg-card px-2 py-1.5 text-left transition-colors",
            editable &&
              "hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            amount.isCustom &&
              "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20",
            !editable && "cursor-default opacity-95",
          )}
        >
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {amount.pending
                ? "Price…"
                : amount.isCustom
                  ? "Room / night"
                  : "Package / night"}
            </p>
            {editable ? (
              <PencilIcon className="size-3 shrink-0 text-muted-foreground" />
            ) : null}
          </div>
          <p className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">
            {nightly != null && Number.isFinite(nightly)
              ? formatGuestBtn(nightly)
              : amount.pending
                ? "…"
                : "—"}
          </p>
          <div className="mt-1 space-y-px border-t border-border/50 pt-1 text-xs tabular-nums text-muted-foreground">
            <div className="flex justify-between gap-2">
              <span>{staySpanLabel}</span>
              <span className="font-medium text-foreground">
                {stayTotal != null ? formatGuestBtn(stayTotal) : "—"}
              </span>
            </div>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {amount.rateLabel ? `${amount.rateLabel} · ` : ""}
            {amount.mealPlanCode ? `${amount.mealPlanCode} · ` : ""}
            {stayRooms} rm
            {(amount.children ?? 0) > 0 ? ` · ${amount.children} child` : ""}
            {(amount.extraBeds ?? 0) > 0 ? ` · ${amount.extraBeds} extra` : ""}
            {amount.isCustom ? " · agreed" : " · sheet"}
            {editable ? " · edit" : ""}
          </p>
        </button>
      ) : null}

      {!showDue && !balanceClear && railActions && amount ? (
        <div className="flex flex-col gap-1 [&_button]:h-8 [&_button]:min-h-8 [&_button]:w-full [&_button]:px-2 [&_button]:text-[11px]">
          {railActions}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <aside
      className={cn(
        "hidden min-h-0 w-60 shrink-0 flex-col border-r bg-[#f6f1ea] md:flex",
        className,
      )}
    >
      <div className="shrink-0 space-y-1 border-b border-border/70 px-3 py-2">
        {backLabel && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-0.5 inline-flex min-h-7 max-w-full items-center gap-0.5 rounded-md px-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeftIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{backLabel}</span>
          </button>
        ) : null}

        <div className="space-y-0.5">
          <h2 className="text-[15px] font-semibold leading-snug tracking-tight text-foreground">
            {(guestName ?? "").trim() || "Walk-in guest"}
          </h2>
          <p className="text-[13px] text-foreground/80">
            {roomLabel ? `Room ${roomLabel}` : "No room"}
            {roomTypeName?.trim() ? ` · ${roomTypeName.trim()}` : ""}
          </p>
          {roomAction ? <div className="pt-1">{roomAction}</div> : null}
        </div>

        <p className="text-xs leading-snug text-muted-foreground">
          {checkIn && checkOut
            ? [
                stayMetaLine({
                  checkIn,
                  checkOut,
                  bookingId: conf ? null : bookingId,
                  confirmationCode: conf,
                })
                  .split(" · ")
                  .filter((part) => part !== "Unassigned")
                  .join(" · "),
              ].join("")
            : "Dates loading"}
        </p>

        <div className="flex flex-wrap items-center gap-1">
          {status ? (
            <Badge
              variant={statusBadgeVariant(status)}
              className="text-[11px] capitalize"
            >
              {statusLabel(status)}
            </Badge>
          ) : null}
          <HkStatusChip status={hkStatus} />
        </div>

        {agentName?.trim() ? (
          <div className="rounded-md border bg-background/80 px-2 py-1">
            <div className="flex flex-wrap items-center gap-1">
              <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                {agentName.trim()}
              </p>
              {agentChip ? (
                <Badge
                  variant={creditOk ? "citrus" : "gold"}
                  className="shrink-0 text-[11px] capitalize"
                >
                  {agentChip}
                </Badge>
              ) : null}
            </div>
            {paymentMode ? (
              <p className="truncate text-[10px] text-muted-foreground">
                {foPaymentModeShort(paymentMode)}
              </p>
            ) : null}
          </div>
        ) : paymentMode ? (
          <p className="text-[10px] text-muted-foreground">
            {foPaymentModeShort(paymentMode)}
          </p>
        ) : null}

        {saveStatus && saveStatus !== "idle" ? (
          <p
            className={cn(
              "text-xs font-medium",
              saveStatus === "saved" && "text-emerald-700 dark:text-emerald-400",
              saveStatus === "error" && "text-destructive",
              saveStatus === "saving" && "text-muted-foreground",
            )}
          >
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved"
                : "Save failed"}
          </p>
        ) : null}

        {alerts
          .filter((a) => a.key !== "dues")
          .map((a) => (
            <p
              key={a.key}
              className={cn(
                "text-xs leading-snug",
                a.tone === "danger" && "text-destructive",
                a.tone === "warn" && "text-amber-900 dark:text-amber-100",
                a.tone === "info" && "text-muted-foreground",
              )}
            >
              {a.label}
            </p>
          ))}

        {lockHint ? (
          <div className="space-y-1">
            <p className="text-xs leading-snug text-amber-950 dark:text-amber-100">
              {lockHint}
            </p>
            {onForceLock ? (
              <button
                type="button"
                onClick={onForceLock}
                className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
              >
                Take over
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Steps fill middle; amount stays pinned bottom */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <StayProgressStrip
          orientation="vertical"
          steps={steps}
          activePanel={panel}
          terminal={terminal}
          onStepClick={onStepClick}
          canNavigateStep={canNavigateStep}
        />
      </div>

      {amountNode ? (
        <div className="shrink-0 border-t bg-muted/30 px-2 py-2">
          {amountNode}
        </div>
      ) : null}
    </aside>
  );
}

/** @deprecated use StayHubLeftRail — thin alias for older imports */
export function StayHubSideRail({
  steps,
  panel,
  terminal,
  onStepClick,
  canNavigateStep,
  className,
}: {
  steps: StayHubStep[];
  panel: StayHubStepId;
  terminal?: string | null;
  onStepClick?: (id: StayHubStepId, locked: boolean, reason?: string) => void;
  canNavigateStep?: (id: StayHubStepId, step: StayHubStep) => boolean;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "hidden w-28 shrink-0 border-r bg-muted/25 px-1.5 py-2 md:flex md:flex-col md:w-32",
        className,
      )}
    >
      <StayProgressStrip
        orientation="vertical"
        steps={steps}
        activePanel={panel}
        terminal={terminal}
        onStepClick={onStepClick}
        canNavigateStep={canNavigateStep}
      />
    </aside>
  );
}

/** Thin six-step strip above the footer button. */
export function StayHubMobileSteps({
  steps,
  panel,
  onStepClick,
  canNavigateStep,
}: {
  steps: StayHubStep[];
  panel: StayHubStepId;
  terminal?: string | null;
  onStepClick?: (id: StayHubStepId, locked: boolean, reason?: string) => void;
  canNavigateStep?: (id: StayHubStepId, step: StayHubStep) => boolean;
}) {
  if (steps.length === 0) return null;
  const active = steps.some((step) => step.id === panel) ? panel : steps[0].id;
  return (
    <div className="shrink-0 border-b px-3 py-2 md:hidden">
      <Tabs
        value={active}
        onValueChange={(id) => {
          const step = steps.find((item) => item.id === id);
          if (!step || !onStepClick) return;
          const allowed = canNavigateStep
            ? canNavigateStep(step.id, step)
            : !step.locked;
          onStepClick(step.id, !allowed, step.lockReason);
        }}
      >
        <TabsList className="inline-flex h-auto w-auto max-w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
          {steps.map((step) => (
            <TabsTrigger
              key={step.id}
              value={step.id}
              className="h-9 shrink-0 px-3 text-sm"
            >
              {step.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

/** Other sections of this step. The body stays on the current job. */
export function StayHubToolTabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  activeId: string;
  onChange: (id: string) => void;
}) {
  if (tabs.length <= 1) return null;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const rest = tabs.filter((tab) => tab.id !== active?.id);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-xs font-medium text-foreground">{active?.label}</span>
      {rest.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              More
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[80]">
            {rest.map((tab) => (
              <DropdownMenuItem key={tab.id} onSelect={() => onChange(tab.id)}>
                {tab.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function StayHubWorkFrame({
  title,
  description,
  tools,
  children,
  className,
  /** Title + tools on one row; hide description (Folio/Checkout density). */
  dense = false,
}: {
  title?: string;
  description?: string;
  tools?: ReactNode;
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  const showDesc = Boolean(description) && !dense;
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      {(title || showDesc || tools) && (
        <div className={cn(dense && tools ? "space-y-0" : "space-y-1")}>
          {dense && (title || tools) ? (
            <div className="flex flex-wrap items-center gap-2">
              {title ? (
                <h3 className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
              ) : null}
              {tools}
            </div>
          ) : (
            <>
              {(title || showDesc) && (
                <div className="space-y-0">
                  {title ? (
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">
                      {title}
                    </h3>
                  ) : null}
                  {showDesc ? (
                    <p className="text-[11px] text-muted-foreground sm:text-xs">
                      {description}
                    </p>
                  ) : null}
                </div>
              )}
              {tools}
            </>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export type StayHubMoreGroup = "papers" | "account" | "stay";

export type StayHubMoreAction = {
  key: string;
  label: string;
  hint?: string;
  group?: StayHubMoreGroup;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

const MORE_GROUPS: { id: StayHubMoreGroup; label: string }[] = [
  { id: "papers", label: "Papers" },
  { id: "account", label: "Account" },
  { id: "stay", label: "Stay" },
];

/** Footer: price on its own row, then Close · ··· · primary CTA. */
export function StayHubFooterBar({
  primaryCta,
  onClose,
  moreActions,
  identityLine,
  amount,
}: {
  panelLabel?: string;
  primaryCta?: ReactNode;
  onClose: () => void;
  moreActions?: StayHubMoreAction[];
  /** Compact stay identity for party / dense modes. */
  identityLine?: string | null;
  amount?: StayHubRailAmount | null;
}) {
  const nightly = amount?.nightlyBtn;
  const stayTotal = amount?.stayTotalBtn;
  const editable = Boolean(amount?.editable !== false && amount?.onEdit);

  return (
    <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 border-t bg-background px-3 py-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] md:px-4">
        <div className="min-w-0 flex-1 space-y-0.5 md:hidden">
        {identityLine ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {identityLine}
          </p>
        ) : null}
        {amount ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <button
              type="button"
              disabled={!editable}
              onClick={() => amount.onEdit?.()}
              className={cn(
                "inline-flex items-center gap-1 text-sm font-semibold tabular-nums",
                editable
                  ? "text-foreground hover:underline"
                  : "text-foreground",
                amount.isCustom && "text-amber-800 dark:text-amber-100",
              )}
            >
              {nightly != null ? `${formatGuestBtn(nightly)}/n` : "—/n"}
              {editable ? (
                <PencilIcon className="size-3 text-muted-foreground" />
              ) : null}
            </button>
            {stayTotal != null ? (
              <span
                key={stayTotal}
                className="stay-hub-flash text-xs tabular-nums text-muted-foreground"
              >
                Stay {formatGuestBtn(stayTotal)}
              </span>
            ) : null}
            <span className="text-[10px] text-muted-foreground">
              {amount.mealPlanCode && amount.mealPlanCode !== "EP"
                ? `${amount.mealPlanCode} · `
                : ""}
              {Math.max(1, amount.rooms ?? 1)} rm
              {(amount.children ?? 0) > 0 ? ` · ${amount.children} child` : ""}
              {(amount.extraBeds ?? 0) > 0 ? ` · ${amount.extraBeds} extra` : ""}
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 md:ml-auto md:w-auto">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Close
        </button>
        {moreActions && moreActions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="More actions"
              >
                <MoreHorizontalIcon className="size-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-[80] w-[min(36rem,calc(100vw-1.5rem))] p-3"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {MORE_GROUPS.map((group) => {
                  const items = moreActions.filter(
                    (action) => (action.group ?? "stay") === group.id,
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={group.id} className="min-w-0">
                      <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                        {group.label}
                      </p>
                      <div className="flex flex-col">
                        {items.map((action) => (
                          <DropdownMenuItem
                            key={action.key}
                            disabled={action.disabled}
                            className={cn(
                              "flex h-9 flex-col items-start justify-center gap-0 px-2",
                              action.destructive &&
                                "text-destructive focus:text-destructive",
                            )}
                            onSelect={() => action.onSelect()}
                          >
                            <span className="text-sm">{action.label}</span>
                            {action.hint ? (
                              <span className="text-[10px] font-normal text-muted-foreground">
                                {action.hint}
                              </span>
                            ) : null}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {primaryCta}
      </div>
    </div>
  );
}

/** @deprecated Prefer Folio due bar — kept as no-op export for safety. */
export function StayHubSummaryCard(_props: {
  balanceDue: number;
  nextAction: string;
  [key: string]: unknown;
}) {
  return null;
}
