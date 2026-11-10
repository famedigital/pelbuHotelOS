"use client";

import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface OdometerTickerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/**
 * GPU-Composited Monospace Financial Odometer
 * Eliminates layout shift by using fixed-width tabular characters and spring transitions.
 */
export const OdometerTicker: React.FC<OdometerTickerProps> = ({
  value,
  prefix = "Nu. ",
  suffix = "",
  decimals = 0,
  className,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = value;
    if (start === end) return;

    const duration = 400; // ms
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(end);
        prevValueRef.current = end;
      }
    };

    requestAnimationFrame(step);
  }, [value]);

  const formatted = displayValue.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight select-none inline-flex items-baseline transform-gpu",
        className
      )}
    >
      {prefix && <span className="opacity-70 text-[0.85em] mr-0.5">{prefix}</span>}
      <span>{formatted}</span>
      {suffix && <span className="opacity-70 text-[0.85em] ml-0.5">{suffix}</span>}
    </span>
  );
};
