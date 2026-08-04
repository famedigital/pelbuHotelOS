"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CircleHelpIcon } from "lucide-react";

/** Compact “how this works” for long desk blurbs — keeps the section bar focus-first. */
export function DeskHelpHint({
  title = "How this works",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={title}
        >
          <CircleHelpIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-sm leading-relaxed">
        <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
          {title}
        </p>
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
