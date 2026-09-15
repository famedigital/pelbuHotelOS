"use client";

import type { ReactNode } from "react";
import { BlurFade } from "@/components/ui/blur-fade";

/** Subtle ERP entrance — once, small offset, short blur. */
export function DeskBlurFade({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <BlurFade
      delay={delay}
      duration={0.35}
      offset={4}
      blur="4px"
      direction="up"
      className={className}
    >
      {children}
    </BlurFade>
  );
}
