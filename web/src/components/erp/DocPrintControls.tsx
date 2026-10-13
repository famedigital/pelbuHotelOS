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
  onSizeChange,
  stacked = false,
}: {
  defaultSize?: DocumentPaperSize;
  printLabel?: string;
  onSizeChange?: (size: DocumentPaperSize) => void;
  /** Full-width paper toggle and print button, for a narrow options rail. */
  stacked?: boolean;
}) {
  const [size, setSize] = useState<DocumentPaperSize>(defaultSize);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.docPaper = size;
    onSizeChange?.(size);
    return () => {
      delete root.dataset.docPaper;
    };
  }, [size, onSizeChange]);

  return (
    <div
      className={cn(
        "print:hidden",
        stacked
          ? "flex w-full gap-2 max-lg:flex-row max-lg:items-stretch lg:flex-col"
          : "flex flex-wrap items-center gap-2",
      )}
    >
      <div
        className={cn(
          "inline-flex rounded-md border bg-card p-0.5",
          stacked && "flex min-w-0 max-lg:shrink-0 lg:w-full",
        )}
        role="group"
        aria-label="Paper size"
      >
        <button
          type="button"
          onClick={() => setSize("a4")}
          className={cn(
            "h-11 rounded-sm px-3 text-xs font-medium transition-colors touch-manipulation lg:h-9",
            stacked && "flex-1",
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
            "h-11 rounded-sm px-3 text-xs font-medium transition-colors touch-manipulation lg:h-9",
            stacked && "flex-1",
            size === "thermal"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {stacked ? (
            <>
              <span className="lg:hidden">80mm</span>
              <span className="max-lg:hidden">Thermal 80mm</span>
            </>
          ) : (
            "Thermal 80mm"
          )}
        </button>
      </div>
      <Button
        type="button"
        variant="default"
        className={cn(
          "h-11 touch-manipulation lg:h-10",
          stacked && "min-w-0 flex-1 lg:w-full",
        )}
        onClick={() => window.print()}
      >
        {printLabel}
        {stacked ? (
          <span className="max-lg:sr-only">
            {size === "thermal" ? " (80mm)" : " (A4)"}
          </span>
        ) : size === "thermal" ? (
          " (80mm)"
        ) : (
          " (A4)"
        )}
      </Button>
    </div>
  );
}
