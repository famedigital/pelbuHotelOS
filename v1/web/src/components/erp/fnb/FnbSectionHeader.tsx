import type { ReactNode } from "react";

/** Light section header for F&B subpages (no second sticky chrome). */
export function FnbSectionHeader({
  eyebrow = "F&B",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="space-y-1">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
        {eyebrow}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
    </header>
  );
}
