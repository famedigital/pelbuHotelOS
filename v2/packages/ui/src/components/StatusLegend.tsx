import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export type StatusLegendItem = {
  id: string;
  label: string;
  /** CSS color for the swatch (var() or hex). */
  swatch: string;
  hint?: string;
};

type StatusLegendProps = {
  items: StatusLegendItem[];
  className?: string;
  /** Compact single-row scroll on phone. */
  dense?: boolean;
};

/** Field-map style glossary — teaches status colors without leaving the board. */
export function StatusLegend({ items, className, dense }: StatusLegendProps) {
  return (
    <ul
      className={cn(
        "hos-status-legend m-0 flex list-none items-center gap-2 p-0",
        dense
          ? "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex-wrap",
        className,
      )}
      aria-label="Status legend"
    >
      {items.map((item) => (
        <li key={item.id} className="shrink-0" title={item.hint ?? item.label}>
          <span className="hos-status-legend-item inline-flex items-center gap-1.5">
            <span
              className="hos-status-legend-swatch"
              style={{ background: item.swatch }}
              aria-hidden
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--hos-ink-2)]">
              {item.label}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export type AttentionChipProps = {
  label: string;
  count?: number;
  active?: boolean;
  tone?: "primary" | "emerald" | "brass" | "ruby" | "muted";
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
};

const TONE_ACTIVE: Record<NonNullable<AttentionChipProps["tone"]>, string> = {
  primary:
    "border-[color-mix(in_srgb,var(--hos-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--hos-primary)_16%,var(--hos-cell))] text-[var(--hos-primary)]",
  emerald:
    "border-[color-mix(in_srgb,var(--hos-emerald)_45%,transparent)] bg-[color-mix(in_srgb,var(--hos-emerald)_14%,var(--hos-cell))] text-[var(--hos-emerald)]",
  brass:
    "border-[color-mix(in_srgb,var(--hos-brass)_45%,transparent)] bg-[color-mix(in_srgb,var(--hos-brass)_14%,var(--hos-cell))] text-[var(--hos-brass-ink)]",
  ruby:
    "border-[color-mix(in_srgb,var(--hos-ruby)_45%,transparent)] bg-[color-mix(in_srgb,var(--hos-ruby)_12%,var(--hos-cell))] text-[var(--hos-ruby)]",
  muted:
    "border-[var(--hos-line)] bg-[var(--hos-canvas-2)] text-[var(--hos-ink-2)]",
};

/** Mode-colored attention filter chip (Code-XR “analyses button wears mode color”). */
export function AttentionChip({
  label,
  count,
  active,
  tone = "primary",
  onClick,
  className,
  children,
}: AttentionChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? "true" : undefined}
      className={cn(
        "hos-attention-chip hos-btn-tactile inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-colors",
        active
          ? TONE_ACTIVE[tone]
          : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)] hover:border-[color-mix(in_srgb,var(--hos-primary)_30%,var(--hos-line))]",
        className,
      )}
    >
      {children}
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className="font-mono tabular-nums opacity-90">{count}</span>
      ) : null}
    </button>
  );
}
