import type { ReactNode } from "react";

/** Desk entrance wrapper. Renders immediately — no motion on the desk path. */
export function DeskBlurFade({
  children,
  className,
}: {
  children: ReactNode;
  /** Kept so existing call sites stay valid. Ignored. */
  delay?: number;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
