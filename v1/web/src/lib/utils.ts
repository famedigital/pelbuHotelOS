import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names intelligently — later classes win conflicts,
 * conditional values are flattened. This is the shadcn/ui convention.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
