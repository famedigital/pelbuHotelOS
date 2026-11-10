"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Short rise when a desk block appears. Honors reduced motion in CSS. */
export function DeskBlurFade({
  children,
  className,
}: {
  children: ReactNode;
  /** Kept so existing call sites stay valid. Ignored. */
  delay?: number;
  className?: string;
}) {
  return <div className={cn("desk-rise", className)}>{children}</div>;
}
