"use client";

import { Button } from "@/components/ui/button";

/** Opens the ERP command palette — same as Ctrl/Cmd+K. */
export function DeskSearchHint() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="hidden h-9 gap-1.5 text-muted-foreground md:inline-flex"
      onClick={() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "k",
            metaKey: true,
            bubbles: true,
          }),
        );
      }}
    >
      Search
      <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
        ⌘K
      </kbd>
    </Button>
  );
}
