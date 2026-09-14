"use client";

import { Badge } from "@/components/ui/badge";
import { StayProgressStrip } from "@/components/erp/StayProgressStrip";
import {
  statusLabel,
  stayMetaLine,
} from "@/lib/folio/stay-hub-format";
import {
  type StayHubStep,
  type StayHubStepId,
} from "@/lib/folio/stay-hub-cycle";
import { isCreditAgentStatus } from "@/lib/agents/status";
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
  pending?: boolean;
  /** Open manager PIN rate dialog / Details Rate. */
  onEdit?: () => void;
  editable?: boolean;
};

function statusBadgeVariant(
  status: string,
): "secondary" | "sky" | "citrus" | "gold" | "maroon" {
  if (status === "checked_in") return "citrus";
  if (status === "confirmed") return "sky";
  if (status === "held" || status === "pending") return "gold";
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

function paymentModeShort(mode: string): string {
  const key = mode.trim().toLowerCase();
  if (key === "on_credit") return "On credit";
  if (key === "prepaid") return "Prepaid";
  if (key === "partial") return "Partial";
  if (key === "cash") return "Cash";
  return mode.replace(/_/g, " ");
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
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        hkChipClass(value),
      )}
      title="Housekeeping"
    >
      HK {value}
    </Link>
  );
}

/**
 * Mobile-only compact top bar (md+ identity lives in the left rail).
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
    agentName,
    alerts,
    terminal,
    saveStatus,
    lockHint,
    onForceLock,
    backLabel,
    onBack,
    dueChipBtn,
    hkStatus,
  } = props;

  const showDueChip =
    dueChipBtn != null &&
    Math.abs(dueChipBtn) > 0.5 &&
    Math.abs(dueChipBtn) < 1_000_000;

  const conf =
    confirmationCode?.trim() ||
    (bookingId ? bookingId.slice(0, 8) : "");

  return (
    <div className="shrink-0 border-b bg-card px-3 py-2 pr-11 md:hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {backLabel && onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="-ml-1 inline-flex min-h-9 items-center gap-0.5 rounded-md px-1 text-xs font-medium text-muted-foreground"
            >
              <ChevronLeftIcon className="size-3.5" aria-hidden />
              {backLabel}
            </button>
          ) : (
            <p className="text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Edit Transaction
            </p>
          )}
          <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
            {(guestName ?? "").trim() || "Walk-in guest"}
          </h2>
          <p className="truncate text-[10px] text-muted-foreground">
            {[
              roomLabel?.trim(),
              checkIn && checkOut
                ? `${checkIn.slice(5)}→${checkOut.slice(5)}`
                : null,
              conf,
              agentName?.trim(),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {showDueChip ? (
            <Badge variant="maroon" className="tabular-nums text-[10px]">
              Due {formatGuestBtn(dueChipBtn)}
            </Badge>
          ) : null}
          {status ? (
            <Badge
              variant={statusBadgeVariant(status)}
              className="text-[10px] capitalize"
            >
              {statusLabel(status)}
            </Badge>
          ) : null}
          <HkStatusChip status={hkStatus} />
          {saveStatus && saveStatus !== "idle" ? (
            <span className="text-[10px] text-muted-foreground">
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved"
                  : "Save failed"}
            </span>
          ) : null}
        </div>
      </div>
      {alerts.filter((a) => a.key !== "dues").length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {alerts
            .filter((a) => a.key !== "dues")
            .slice(0, 3)
            .map((a) => (
              <Badge
                key={a.key}
                variant={
                  a.tone === "danger"
                    ? "destructive"
                    : a.tone === "warn"
                      ? "maroon"
                      : "secondary"
                }
                className="text-[9px]"
              >
                {a.label}
              </Badge>
            ))}
        </div>
      ) : null}
      {terminal ? (
        <p className="mt-1 text-center text-[10px] font-medium capitalize text-destructive">
          {terminal.replace(/_/g, " ")}
        </p>
      ) : null}
      {lockHint ? (
        <div className="mt-1 space-y-0.5">
          <p className="text-[10px] leading-snug text-amber-800 dark:text-amber-200">
            {lockHint}
          </p>
          {onForceLock ? (
            <button
              type="button"
              onClick={onForceLock}
              className="text-[10px] font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-100"
            >
              Take over this stay
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
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
        <div className="rounded-md border border-maroon/30 bg-maroon/5 px-2 py-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
              Open balance
            </p>
            <p className="text-lg font-semibold tabular-nums tracking-tight text-maroon">
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
            <p className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
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
            <p className="text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
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
          <p className="mt-0.5 text-base font-semibold tracking-tight tabular-nums">
            {nightly != null && Number.isFinite(nightly)
              ? formatGuestBtn(nightly)
              : amount.pending
                ? "…"
                : "—"}
          </p>
          <div className="mt-1 space-y-px border-t border-border/50 pt-1 text-[10px] tabular-nums text-muted-foreground">
            <div className="flex justify-between gap-2">
              <span>{staySpanLabel}</span>
              <span className="font-medium text-foreground">
                {stayTotal != null ? formatGuestBtn(stayTotal) : "—"}
              </span>
            </div>
          </div>
          {amount.mealPlanCode ? (
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              {amount.mealPlanCode}
              {amount.isCustom ? " · agreed" : " · sheet"}
              {amount.isCustom ? " · tax as sheet" : ""}
              {editable ? " · edit" : ""}
            </p>
          ) : null}
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
        "hidden min-h-0 w-[13.5rem] shrink-0 flex-col border-r bg-muted/20 lg:w-60 md:flex",
        className,
      )}
    >
      <div className="shrink-0 space-y-1.5 border-b px-2.5 py-2">
        {backLabel && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-0.5 inline-flex min-h-7 max-w-full items-center gap-0.5 rounded-md px-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeftIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{backLabel}</span>
          </button>
        ) : (
          <p className="text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Edit Transaction
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="min-w-0 flex-1 text-sm font-semibold leading-snug tracking-tight text-foreground">
            {(guestName ?? "").trim() || "Walk-in guest"}
          </h2>
          {status ? (
            <Badge
              variant={statusBadgeVariant(status)}
              className="shrink-0 text-[9px] capitalize"
            >
              {statusLabel(status)}
            </Badge>
          ) : null}
          <HkStatusChip status={hkStatus} />
        </div>

        {checkIn && checkOut ? (
          <p className="text-[10px] leading-snug text-muted-foreground">
            {stayMetaLine({
              roomLabel,
              roomTypeName,
              checkIn,
              checkOut,
              bookingId: conf ? null : bookingId,
              confirmationCode: conf,
            })}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">Loading…</p>
        )}

        {agentName?.trim() ? (
          <div className="rounded-md border bg-background/80 px-2 py-1">
            <div className="flex flex-wrap items-center gap-1">
              <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                {agentName.trim()}
              </p>
              {agentChip ? (
                <Badge
                  variant={creditOk ? "citrus" : "gold"}
                  className="shrink-0 text-[9px] capitalize"
                >
                  {agentChip}
                </Badge>
              ) : null}
            </div>
            {paymentMode ? (
              <p className="truncate text-[10px] text-muted-foreground capitalize">
                {paymentModeShort(paymentMode)}
              </p>
            ) : null}
          </div>
        ) : null}

        {alerts.filter((a) => a.key !== "dues").length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {alerts
              .filter((a) => a.key !== "dues")
              .map((a) => (
                <Badge
                  key={a.key}
                  variant={
                    a.tone === "danger"
                      ? "destructive"
                      : a.tone === "warn"
                        ? "maroon"
                        : "secondary"
                  }
                  className="max-w-full truncate text-[9px]"
                  title={a.label}
                >
                  {a.label}
                </Badge>
              ))}
          </div>
        ) : null}

        {lockHint ? (
          <div className="space-y-1">
            <p className="text-[10px] leading-snug text-amber-800 dark:text-amber-200">
              {lockHint}
            </p>
            {onForceLock ? (
              <button
                type="button"
                onClick={onForceLock}
                className="text-[10px] font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-100"
              >
                Take over this stay
              </button>
            ) : null}
          </div>
        ) : null}

        {saveStatus && saveStatus !== "idle" ? (
          <p
            className={cn(
              "text-[10px] font-medium",
              saveStatus === "saved" &&
                "text-emerald-700 dark:text-emerald-400",
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
      </div>

      {/* Steps fill middle; amount stays pinned bottom */}
      <div className="min-h-0 flex-1 overflow-hidden px-1 py-1.5">
        <p className="mb-0.5 px-2 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Steps
        </p>
        <StayProgressStrip
          orientation="vertical"
          dense
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

/** Mobile / narrow: compact horizontal steps under header. */
export function StayHubMobileSteps({
  steps,
  panel,
  terminal,
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
  return (
    <div className="shrink-0 border-b px-2 py-1 md:hidden">
      <StayProgressStrip
        orientation="horizontal"
        steps={steps}
        activePanel={panel}
        terminal={terminal}
        onStepClick={onStepClick}
        canNavigateStep={canNavigateStep}
      />
    </div>
  );
}

/** Tool tabs for the active hierarchy step only. */
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
  return (
    <div
      className="flex min-w-0 flex-1 gap-0.5 rounded-md border bg-muted/40 p-0.5"
      role="tablist"
      aria-label="Step tools"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeId === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "min-h-9 flex-1 rounded px-2 text-xs font-medium transition-colors",
            activeId === t.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
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

export type StayHubMoreAction = {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

/** Footer: identity/price (left) · Close · ··· · primary CTA (right) */
export function StayHubFooterBar({
  panelLabel,
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
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-4">
      <div className="min-w-0 flex-1 space-y-0.5">
        {identityLine ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {identityLine}
          </p>
        ) : panelLabel ? (
          <p className="hidden text-xs font-medium text-muted-foreground sm:block">
            {panelLabel}
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
              <span className="text-xs tabular-nums text-muted-foreground">
                Stay {formatGuestBtn(stayTotal)}
              </span>
            ) : null}
            {amount.mealPlanCode && amount.mealPlanCode !== "EP" ? (
              <span className="text-[10px] text-muted-foreground">
                {amount.mealPlanCode}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex-none"
        >
          Close
        </button>
        {moreActions && moreActions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="More actions"
              >
                <MoreHorizontalIcon className="size-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {moreActions.map((a) => (
                <DropdownMenuItem
                  key={a.key}
                  disabled={a.disabled}
                  className={cn(
                    a.destructive && "text-destructive focus:text-destructive",
                  )}
                  onSelect={() => a.onSelect()}
                >
                  {a.label}
                </DropdownMenuItem>
              ))}
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
