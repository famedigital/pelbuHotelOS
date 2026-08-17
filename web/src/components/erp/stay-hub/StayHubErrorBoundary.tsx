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
        className="erp fixed inset-x-0 bottom-0 z-[80] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        role="alert"
      >
        <div className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg">
          <p className="text-sm font-semibold tracking-tight">
            Stay could not open
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The reservations list is still usable. Retry this stay, or open the
            room rack from a fresh tab.
          </p>
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            onClick={() => this.setState({ error: null })}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }
}
