"use client";

import { Button } from "@/components/ui/button";
import { openErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { useEffect, useState } from "react";

function deskShortcutLabel(): string {
  if (typeof navigator === "undefined") return "⌘K";
  return /Win/i.test(navigator.platform) ? "Ctrl+K" : "⌘K";
}

/** Opens the ERP command palette — same as Ctrl/Cmd+K. */
export function DeskSearchHint() {
  const [shortcut, setShortcut] = useState("⌘K");

  useEffect(() => {
    setShortcut(deskShortcutLabel());
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="hidden h-9 gap-1.5 text-muted-foreground md:inline-flex"
      onClick={() => openErpCommandPalette()}
    >
      Search
      <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
        {shortcut}
      </kbd>
    </Button>
  );
}
