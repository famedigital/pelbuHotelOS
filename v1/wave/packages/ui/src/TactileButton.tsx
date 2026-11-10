import { motion, type HTMLMotionProps } from "framer-motion";
import { clsx } from "clsx";
import { NeoSpatialTokens } from "./tokens";

/** Omit `key` so duplicate @types/react (pnpm vs npm) cannot collide on React 19's Key type. */
export interface TactileButtonProps extends Omit<HTMLMotionProps<"button">, "key"> {
  variant?: "primary" | "ghost" | "danger" | "success";
}

export function TactileButton({
  className,
  variant = "primary",
  children,
  ...props
}: TactileButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97, y: 1 }}
      transition={NeoSpatialTokens.springs.snappy}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
        variant === "primary" &&
          "bg-amber-600 text-white hover:bg-amber-500 shadow-sm",
        variant === "ghost" &&
          "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
        variant === "success" &&
          "bg-emerald-600 text-white hover:bg-emerald-500",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
