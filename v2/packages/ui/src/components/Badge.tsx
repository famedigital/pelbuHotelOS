import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
  {
    variants: {
      tone: {
        default:
          "border-[color-mix(in_srgb,var(--hos-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--hos-primary)_18%,transparent)] text-[var(--hos-primary)]",
        vip: "border-[color-mix(in_srgb,var(--hos-brass)_55%,transparent)] bg-[color-mix(in_srgb,var(--hos-brass)_22%,transparent)] text-[var(--hos-brass-ink)]",
        success:
          "border-[color-mix(in_srgb,var(--hos-emerald)_50%,transparent)] bg-[color-mix(in_srgb,var(--hos-emerald)_18%,transparent)] text-[var(--hos-emerald)]",
        danger:
          "border-[color-mix(in_srgb,var(--hos-ruby)_50%,transparent)] bg-[color-mix(in_srgb,var(--hos-ruby)_18%,transparent)] text-[var(--hos-ruby)]",
        muted:
          "border-[var(--hos-line)] bg-[rgba(15,23,42,0.06)] text-[var(--hos-ink-2)]",
        teal: "border-[color-mix(in_srgb,var(--hos-teal)_50%,transparent)] bg-[color-mix(in_srgb,var(--hos-teal)_18%,transparent)] text-[var(--hos-teal)]",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
