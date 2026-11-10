import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "hos-luxury-card flex flex-col items-center justify-center gap-2.5 border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <strong className="text-[14px] font-semibold tracking-tight text-[var(--hos-ink)]">
        {title}
      </strong>
      {description ? (
        <p className="m-0 max-w-sm text-[12px] leading-relaxed text-[var(--hos-ink-3)]">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
