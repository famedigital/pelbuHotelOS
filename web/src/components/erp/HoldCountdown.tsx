"use client";

import { useEffect, useState } from "react";

/** Flight-style countdown until a booking hold expires. */
export function HoldCountdown({
  expiresAt,
  className,
}: {
  expiresAt: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) {
    return <span className={className}>Hold time unknown</span>;
  }

  const ms = end - now;
  if (ms <= 0) {
    return (
      <span className={className ?? "font-semibold text-destructive"}>
        Hold expired — ask the desk to re-hold or confirm
      </span>
    );
  }

  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const label =
    hours > 0
      ? `${hours}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
      : `${mins}m ${String(secs).padStart(2, "0")}s`;

  return (
    <span className={className ?? "font-mono text-lg font-semibold tabular-nums"}>
      {label}
    </span>
  );
}
