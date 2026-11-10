import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export type LedTone = "emerald" | "sapphire" | "brass" | "ruby" | "violet";

export type LedBeaconProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: LedTone;
  /** When false, aura does not breathe (e.g. offline). Default true. */
  pulse?: boolean;
  label?: string;
};

const TONE_CLASS: Record<LedTone, string> = {
  emerald: "hos-led--emerald",
  sapphire: "hos-led--sapphire",
  brass: "hos-led--brass",
  ruby: "hos-led--ruby",
  violet: "hos-led--violet",
};

export function LedBeacon({
  tone = "emerald",
  pulse = true,
  label,
  className,
  ...props
}: LedBeaconProps) {
  return (
    <span
      className={cn(
        "hos-led-beacon inline-flex items-center gap-1.5",
        className,
      )}
      role={label ? "status" : undefined}
      aria-label={label}
      {...props}
    >
      <span
        className={cn(
          "hos-led",
          TONE_CLASS[tone],
          pulse ? "hos-led--pulse" : "hos-led--steady",
        )}
        aria-hidden
      />
      {label ? (
        <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
          {label}
        </span>
      ) : null}
    </span>
  );
}
