"use client";

import type { ReactNode } from "react";
import { BlurFade } from "@/components/ui/blur-fade";

export function MarketingReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <BlurFade delay={delay} inView className={className}>
      {children}
    </BlurFade>
  );
}
