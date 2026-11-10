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
    <section className={cn("rounded-lg border bg-card p-3 md:p-4", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          {eyebrow ? (
            <p className="text-xs font-medium text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {status === "ready" ? (
              <span className="rounded-md border border-mint-500/30 bg-mint-100 px-2 py-0.5 text-[11px] font-medium text-mint-600">
                Ready
              </span>
            ) : null}
            {status === "attention" ? (
              <span className="rounded-md border border-citrus/40 bg-citrus-tint px-2 py-0.5 text-[11px] font-medium text-citrus-600">
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
