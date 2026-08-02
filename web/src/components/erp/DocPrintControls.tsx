"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocumentPaperSize } from "@/lib/property-settings";
import { useEffect, useState } from "react";

/**
 * A4 vs thermal (80mm) print controls. Sets a class on `<html>` so @page rules
 * in globals / component print CSS pick the correct sheet size.
 */
export function DocPrintControls({
  defaultSize = "a4",
  printLabel = "Print",
}: {
  defaultSize?: DocumentPaperSize;
  printLabel?: string;
}) {
  const [size, setSize] = useState<DocumentPaperSize>(defaultSize);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.docPaper = size;
    return () => {
      delete root.dataset.docPaper;
    };
  }, [size]);

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div
        className="inline-flex rounded-md border bg-card p-0.5"
        role="group"
        aria-label="Paper size"
      >
        <button
          type="button"
          onClick={() => setSize("a4")}
          className={cn(
            "h-9 rounded-sm px-3 text-xs font-medium transition-colors",
            size === "a4"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          A4
        </button>
        <button
          type="button"
          onClick={() => setSize("thermal")}
          className={cn(
            "h-9 rounded-sm px-3 text-xs font-medium transition-colors",
            size === "thermal"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          Thermal 80mm
        </button>
      </div>
      <Button
        type="button"
        variant="citrus"
        className="h-10"
        onClick={() => window.print()}
      >
        {printLabel}
        {size === "thermal" ? " (80mm)" : " (A4)"}
      </Button>
    </div>
  );
}
