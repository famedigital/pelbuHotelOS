import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn.js";

type OdometerProps = {
  value: string | number;
  className?: string;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
};

function parseNumeric(value: string | number): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // Strip currency / labels first so "Nu. 284,800" does not become ".284800" → 0.
  const cleaned = String(value)
    .replace(/Nu\.?/gi, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatLike(template: string | number, n: number): string {
  if (typeof template === "number") {
    return Math.round(n).toLocaleString("en-BT");
  }
  const raw = String(template);
  if (raw.includes("Nu.")) {
    return `Nu. ${Math.round(n).toLocaleString("en-BT")}`;
  }
  if (raw.includes("%")) {
    return `${Math.round(n)}%`;
  }
  if (/,/.test(raw) || raw.includes(".")) {
    return Math.round(n).toLocaleString("en-BT");
  }
  return String(Math.round(n));
}

/** Rolling financial / KPI ticker with eased number interpolation. */
export function Odometer({
  value,
  className,
  durationMs = 560,
  prefix = "",
  suffix = "",
}: OdometerProps) {
  const reduce = useReducedMotion();
  const target = parseNumeric(value);
  const fromRef = useRef(0);
  const [display, setDisplay] = useState(() =>
    target == null ? String(value) : formatLike(value, 0),
  );

  useEffect(() => {
    if (target == null || reduce) {
      setDisplay(String(value));
      fromRef.current = target ?? fromRef.current;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = from + (target - from) * eased;
      setDisplay(formatLike(value, current));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, reduce, target, value]);

  return (
    <span className={cn("tabular-nums tracking-tight", className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
