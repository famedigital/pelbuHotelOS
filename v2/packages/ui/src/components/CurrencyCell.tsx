import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export type CurrencyCellProps = HTMLAttributes<HTMLSpanElement> & {
  amount: number;
  /** Currency symbol prefix, e.g. Nu. $ ₹ */
  symbol?: string;
  /** Show fractional cents (default true when amount has fraction) */
  showCents?: boolean;
  /** Optional signed delta tag, e.g. +350 SC or −1200 Adv */
  delta?: number;
  deltaLabel?: string;
};

function splitAmount(amount: number): { int: string; cents: string; neg: boolean } {
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(2);
  const [i, c] = fixed.split(".");
  const int = Number(i).toLocaleString("en-BT");
  return { int, cents: c ?? "00", neg };
}

export function CurrencyCell({
  amount,
  symbol = "Nu.",
  showCents = true,
  delta,
  deltaLabel,
  className,
  ...props
}: CurrencyCellProps) {
  const { int, cents, neg } = splitAmount(amount);
  const deltaNeg = typeof delta === "number" && delta < 0;
  const deltaAbs =
    typeof delta === "number"
      ? Math.abs(delta).toLocaleString("en-BT", { maximumFractionDigits: 0 })
      : null;

  return (
    <span
      className={cn(
        "hos-currency-cell inline-flex items-baseline gap-1 font-mono tabular-nums",
        className,
      )}
      {...props}
    >
      <span className="inline-flex items-baseline">
        <span className="hos-currency-symbol text-[0.85em] font-semibold opacity-60">
          {neg ? "−" : ""}
          {symbol}
        </span>
        <span className="hos-currency-int ml-0.5 font-black tracking-tight">
          {int}
        </span>
        {showCents ? (
          <span className="hos-currency-cents font-semibold opacity-65">
            .{cents}
          </span>
        ) : null}
      </span>
      {deltaAbs != null ? (
        <span
          className={cn(
            "hos-currency-delta rounded-md px-1 py-0.5 text-[10px] font-bold",
            deltaNeg
              ? "bg-[color-mix(in_srgb,var(--hos-ruby)_16%,transparent)] text-[var(--hos-ruby)]"
              : "bg-[color-mix(in_srgb,var(--hos-emerald)_16%,transparent)] text-[var(--hos-emerald)]",
          )}
        >
          {deltaNeg ? "−" : "+"}
          {symbol} {deltaAbs}
          {deltaLabel ? ` ${deltaLabel}` : ""}
        </span>
      ) : null}
    </span>
  );
}
