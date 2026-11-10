import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn.js";

type InspectorCardProps = {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Fixed hover inspector positioning. */
  floating?: boolean;
};

/**
 * LivePanel-style summary card — glance before opening a deep drawer.
 * Opaque cell background (FO hardware readable).
 */
export function InspectorCard({
  title,
  subtitle,
  badges,
  meta,
  actions,
  className,
  style,
  floating,
}: InspectorCardProps) {
  return (
    <div
      className={cn(
        "hos-inspector-card",
        floating && "hos-inspector-card--floating",
        className,
      )}
      style={style}
      role="dialog"
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[13px] font-black tracking-tight text-[var(--hos-ink)]">
            {title}
          </strong>
          {subtitle ? (
            <p className="m-0 mt-0.5 truncate text-[11px] text-[var(--hos-ink-2)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {badges ? <div className="flex shrink-0 flex-wrap gap-1">{badges}</div> : null}
      </div>
      {meta ? (
        <div className="mt-2 space-y-1 text-[11px] text-[var(--hos-ink-2)]">{meta}</div>
      ) : null}
      {actions ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[var(--hos-line)] pt-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
