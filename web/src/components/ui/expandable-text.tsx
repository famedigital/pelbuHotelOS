"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

/** Collapsible prose for dense desk notes / long descriptions. */
export function ExpandableText({
  children,
  maxChars = 160,
  className,
}: {
  children: string;
  maxChars?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const needsClamp = children.length > maxChars;
  const shown =
    !needsClamp || open ? children : `${children.slice(0, maxChars).trimEnd()}…`;

  return (
    <div className={cn("text-sm text-muted-foreground", className)}>
      <p className="whitespace-pre-wrap">{shown}</p>
      {needsClamp ? (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-accent underline-offset-2 hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
