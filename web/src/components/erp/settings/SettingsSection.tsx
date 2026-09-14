import { cn } from "@/lib/utils";

export function SettingsSection({
  eyebrow,
  title,
  description,
  blastRadius,
  status,
  children,
  className,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** One line — “What this controls: …” */
  blastRadius?: string;
  status?: "ready" | "attention";
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 md:p-6", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          {eyebrow ? (
            <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {status === "ready" ? (
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                Ready
              </span>
            ) : null}
            {status === "attention" ? (
              <span className="rounded-md border border-amber-500/35 bg-amber-500/[0.06] px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-200">
                Needs attention
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
          {blastRadius ? (
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                What this controls:{" "}
              </span>
              {blastRadius}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
