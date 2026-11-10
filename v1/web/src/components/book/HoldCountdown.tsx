"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** ISO timestamp the hold expires at. */
  expiresAt: string;
  /** Optional full timestamp string shown as fallback / for accessibility. */
  formattedExpiry?: string;
};

type Remaining = {
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function computeRemaining(expiresAt: string, now: number): Remaining | null {
  const totalMs = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(totalMs)) return null;
  if (totalMs <= 0) {
    return { totalMs: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Live countdown to a booking hold's expiry. SSR-safe (null until mount).
 */
export function HoldCountdown({ expiresAt, formattedExpiry }: Props) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const next = computeRemaining(expiresAt, Date.now());
      setRemaining(next);
      if (next && next.totalMs <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [expiresAt]);

  if (!remaining) {
    return formattedExpiry ? (
      <p className="text-sm text-muted-foreground">
        Hold expires {formattedExpiry}
      </p>
    ) : null;
  }

  if (remaining.totalMs <= 0) {
    return (
      <p className="text-sm font-medium text-destructive">Hold expired</p>
    );
  }

  const label =
    remaining.hours > 0
      ? `${remaining.hours}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`
      : `${pad(remaining.minutes)}:${pad(remaining.seconds)}`;

  return (
    <p className="text-sm tabular-nums text-muted-foreground">
      Hold expires in{" "}
      <span className="font-medium text-foreground">{label}</span>
      {formattedExpiry ? (
        <span className="sr-only"> ({formattedExpiry})</span>
      ) : null}
    </p>
  );
}
