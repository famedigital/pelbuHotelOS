import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/cn.js";
import { springPress, springSoft } from "../motion/presets.js";
import { Odometer } from "./Odometer.js";

type KpiCardProps = {
  label: string;
  value: string | number;
  delta?: string;
  sparkline?: number[];
  className?: string;
  glow?: "emerald" | "gold" | "sapphire" | "brass" | "booked";
};

function MiniSpark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(max - min, 1);
  const w = 64;
  const h = 20;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="opacity-80">
      <path d={d} fill="none" stroke="var(--hos-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function KpiCard({ label, value, delta, sparkline, className }: KpiCardProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.98 },
        show: { opacity: 1, y: 0, scale: 1, transition: springSoft },
      }}
      whileHover={reduce ? undefined : { y: -2, transition: springSoft }}
      whileTap={reduce ? undefined : { scale: 0.985, transition: springPress }}
    >
      <div
        className={cn(
          "hos-luxury-card hos-butter-card flex min-h-[68px] flex-col justify-center gap-0.5 px-3 py-2",
          className,
        )}
      >
        <div className="hos-section-label truncate">{label}</div>
        <div className="flex items-end justify-between gap-2">
          <Odometer
            value={value}
            className="font-mono text-[1.25rem] font-black tabular-nums tracking-tight text-[var(--hos-ink)]"
          />
          {sparkline ? <MiniSpark points={sparkline} /> : null}
        </div>
        {delta ? (
          <div className="truncate text-[10px] font-semibold tabular-nums text-[var(--hos-primary)]">
            {delta}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
