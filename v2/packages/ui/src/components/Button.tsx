import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useRef,
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn.js";
import { springSnappy, volaroEase } from "../motion/presets.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-full text-[14px] font-medium tracking-[0.01em] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hos-primary)] focus-visible:ring-offset-2 will-change-transform",
  {
    variants: {
      variant: {
        primary:
          "hos-btn-primary hos-btn-spring text-white shadow-[var(--hos-primary-glow)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--hos-primary)] hover:bg-[color-mix(in_srgb,var(--hos-primary)_10%,transparent)]",
        danger: "rounded-full bg-[var(--hos-ruby)] text-white shadow-[0_1px_2px_rgba(197,34,31,0.25)]",
        secondary:
          "border border-transparent bg-[var(--hos-primary-container)] text-[var(--hos-primary-on-container)] hover:brightness-[0.97]",
      },
      size: {
        sm: "h-9 min-h-[36px] px-4 text-[13px]",
        md: "h-10 min-h-[40px] px-5",
        lg: "h-12 min-h-[48px] px-6 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    children?: ReactNode;
    /** Soft cursor magnetism — Volaro primary CTAs */
    magnetic?: boolean;
  };

/** Enterprise CTA — opaque fill + Volaro spring press (+ optional magnetic). */
export function Button({
  className,
  variant,
  size,
  asChild,
  children,
  type = "button",
  disabled,
  magnetic = false,
  onMouseMove,
  onMouseLeave,
  ...props
}: ButtonProps) {
  const reduce = useReducedMotion();
  const classes = cn(buttonVariants({ variant, size }), className);
  const nodeRef = useRef<HTMLButtonElement | null>(null);
  const frame = useRef(0);
  const strength = 7;
  const enableMagnetic =
    magnetic && !reduce && !disabled && (variant === "primary" || variant == null);

  const handleMove = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      onMouseMove?.(e);
      if (!enableMagnetic) return;
      if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
        return;
      }
      const el = nodeRef.current;
      if (!el) return;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        const tx = (x / Math.max(rect.width / 2, 1)) * strength;
        const ty = (y / Math.max(rect.height / 2, 1)) * strength;
        el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
      });
    },
    [enableMagnetic, onMouseMove],
  );

  const handleLeave = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      onMouseLeave?.(e);
      cancelAnimationFrame(frame.current);
      if (nodeRef.current) {
        nodeRef.current.style.transform = "translate3d(0, 0, 0)";
      }
    },
    [onMouseLeave],
  );

  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <motion.button
      ref={nodeRef}
      type={type}
      className={classes}
      disabled={disabled}
      style={
        enableMagnetic
          ? { transition: `transform 0.35s cubic-bezier(${volaroEase.join(",")})` }
          : undefined
      }
      whileHover={
        reduce || disabled || enableMagnetic
          ? undefined
          : { y: -1, transition: springSnappy }
      }
      whileTap={
        reduce || disabled
          ? undefined
          : { scale: 0.97, y: 1, transition: { duration: 0.08 } }
      }
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
}
