import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export type KeycapBadgeProps = HTMLAttributes<HTMLElement> & {
  /** Chord or key label, e.g. ⌘K, Esc, ⌘↵ */
  keys: string;
};

export function KeycapBadge({ keys, className, ...props }: KeycapBadgeProps) {
  return (
    <kbd className={cn("hos-keycap", className)} {...props}>
      {keys}
    </kbd>
  );
}
