"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * StayHub is mounted from DeskShell (ERP layout). A render throw there
 * skips `erp/error.tsx` and lands on `global-error` — taking the whole desk
 * down. Catch here so the reservations list stays usable.
 */
export class StayHubErrorBoundary extends Component<
  {
    children: ReactNode;
    onCrash?: () => void;
    /** When set, render this instead of the stay-open banner (e.g. print host). */
    fallback?: ReactNode;
  },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[stay-hub]", error, info.componentStack);
    this.props.onCrash?.();
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div
        className="erp fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[80] md:inset-x-auto md:right-4 md:bottom-4"
        role="alert"
      >
        <div className="flex max-w-md items-center gap-2 rounded-md border bg-background px-3 py-2 shadow-lg">
          <p className="min-w-0 flex-1 text-xs text-foreground">
            Couldn’t open stay — retry from the rack.
          </p>
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-accent"
            onClick={() => this.setState({ error: null })}
          >
            OK
          </button>
        </div>
      </div>
    );
  }
}
