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
 * Live countdown to a booking hold's expiry. Renders nothing on the server to
 * avoid hydration mismatch (we don't know the client clock until mount); the
 * first paint after mount shows the real remaining time and ticks once a second.
 *
 * Pure UI — does NOT release the hold. Inventory correctness depends on the
 * server's read-time filter in `soldQtyByRoomType`, not on this clock.
 */
export function HoldCountdown({ expiresAt, formattedExpiry }: Props) {
  // Null on first render so SSR and the first client paint match.
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [mounted, setMounted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);

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

  if (!mounted || !remaining) {
    return formattedExpiry ? (
      <p className="text-sm text-maroon">
        Hold expires {formattedExpiry}
      </p>
    ) : null;
  }

  if (remaining.totalMs <= 0) {
    return (
      <p className="text-sm font-medium text-maroon" role="status">
        Hold expired — your rooms have been released. Contact the desk to rebook.
      </p>
    );
  }

  const isUrgent = remaining.totalMs < 5 * 60 * 1000; // < 5 min
  const isWarning = remaining.totalMs < 30 * 60 * 1000; // < 30 min
  const tone = isUrgent ? "text-maroon" : isWarning ? "text-gold" : "text-espresso";

  return (
    <div
      className={`flex items-center gap-2 text-sm ${tone}`}
      role="timer"
      aria-live="polite"
      aria-label={`Hold expires in ${remaining.hours} hours ${remaining.minutes} minutes`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
      <span>
        Rooms held for{" "}
        <span className="font-mono tabular-nums font-medium">
          {remaining.hours > 0 ? `${remaining.hours}:${pad(remaining.minutes)}:${pad(remaining.seconds)}` : `${pad(remaining.minutes)}:${pad(remaining.seconds)}`}
        </span>
      </span>
    </div>
  );
}
