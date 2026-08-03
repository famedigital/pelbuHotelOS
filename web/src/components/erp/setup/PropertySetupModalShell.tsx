import Link from "next/link";
import type { ReactNode } from "react";

export const SETUP_STEPS: { n: number; label: string }[] = [
  { n: 1, label: "Identity" },
  { n: 2, label: "Rooms" },
  { n: 3, label: "Rates" },
  { n: 4, label: "Commercial" },
  { n: 5, label: "Go live" },
];

export function PropertySetupModalShell({
  propertyId,
  propertyName,
  step,
  title,
  blurb,
  completed,
  children,
  footerNote,
}: {
  propertyId?: string;
  propertyName?: string;
  step: number;
  title: string;
  blurb: string;
  completed?: boolean;
  children: ReactNode;
  footerNote?: ReactNode;
}) {
  const pct = Math.round((Math.min(5, Math.max(1, step)) / 5) * 100);
  const setupBase = propertyId
    ? `/erp/properties/${propertyId}/setup`
    : "/erp/properties/new";

  return (
    <div className="erp fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      {/* Backplane link — click outside dismisses to desk */}
      <Link
        href="/erp"
        className="absolute inset-0"
        aria-label="Close setup and return to desk"
        tabIndex={-1}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-wizard-title"
        className="relative z-10 flex h-[100dvh] w-full max-w-none flex-col overflow-hidden border-0 bg-background shadow-2xl sm:h-[min(92dvh,52rem)] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-border"
      >
        {/* Progress header */}
        <header className="shrink-0 border-b border-border bg-gradient-to-b from-muted/50 to-background px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                Hotel setup
                {propertyName ? (
                  <span className="text-muted-foreground"> · {propertyName}</span>
                ) : null}
              </p>
              <h1
                id="setup-wizard-title"
                className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                {title}
              </h1>
            </div>
            <Link
              href="/erp"
              className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Close
            </Link>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">{blurb}</p>

          {/* Track */}
          <div
            className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Setup ${pct}% complete`}
          >
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Step chips */}
          <nav
            className="flex gap-1 overflow-x-auto pb-0.5"
            aria-label="Setup steps"
          >
            {SETUP_STEPS.map((s) => {
              const active = s.n === step;
              const done = s.n < step || Boolean(completed && s.n <= step);
              const href =
                propertyId && s.n > 1
                  ? `${setupBase}?step=${s.n}`
                  : s.n === 1 && propertyId
                    ? `${setupBase}?step=1`
                    : s.n === 1
                      ? "/erp/properties/new"
                      : undefined;

              const classes = active
                ? "border-foreground bg-foreground text-background"
                : done
                  ? "border-border bg-muted/80 text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground";

              const inner = (
                <>
                  <span
                    className={
                      active
                        ? "flex size-5 items-center justify-center rounded-full bg-background/20 text-[10px] font-semibold"
                        : done
                          ? "flex size-5 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-semibold"
                          : "flex size-5 items-center justify-center rounded-full border border-border text-[10px] font-semibold"
                    }
                  >
                    {done && !active ? "✓" : s.n}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </>
              );

              if (href) {
                return (
                  <Link
                    key={s.n}
                    href={href}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${classes}`}
                    aria-current={active ? "step" : undefined}
                  >
                    {inner}
                  </Link>
                );
              }

              return (
                <span
                  key={s.n}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${classes} opacity-60`}
                  aria-current={active ? "step" : undefined}
                >
                  {inner}
                </span>
              );
            })}
          </nav>

          {completed ? (
            <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Setup was marked complete. You can re-run any step after a data wipe.
            </p>
          ) : null}
        </header>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {children}
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-border bg-muted/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground sm:px-6">
          {footerNote ?? (
            <>
              Step {step} of 5
              {" · "}
              <Link href="/erp" className="underline-offset-2 hover:underline">
                Desk
              </Link>
              {" · "}
              <Link
                href="/erp/settings"
                className="underline-offset-2 hover:underline"
              >
                Settings
              </Link>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
