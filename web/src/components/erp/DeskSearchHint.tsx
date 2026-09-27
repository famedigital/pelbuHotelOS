"use client";

import { Button } from "@/components/ui/button";
import { openErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { SearchIcon } from "lucide-react";
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
      className="hidden h-8 shrink-0 gap-1.5 px-2 text-muted-foreground md:inline-flex"
      aria-label={`Search (${shortcut})`}
      title={`Search (${shortcut})`}
      onClick={() => openErpCommandPalette()}
    >
      <SearchIcon className="size-3.5 xl:hidden" />
      <span className="hidden xl:inline">Search</span>
      <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground xl:inline">
        {shortcut}
      </kbd>
    </Button>
  );
}
