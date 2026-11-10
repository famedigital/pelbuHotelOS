"use client";

import type { DocumentPaperSize } from "@/lib/property-settings";
import { useEffect, useRef } from "react";

/**
 * Opens the browser print dialog after paint (post-settle receipt).
 * Sets data-doc-paper so thermal/A4 @page rules apply before window.print().
 * Retries once if the first call was too early / ignored.
 */
export function AutoPrintOnLoad({
  enabled = true,
  delayMs = 80,
  paper = "thermal",
}: {
  enabled?: boolean;
  delayMs?: number;
  paper?: DocumentPaperSize;
}) {
  const attempts = useRef(0);
  const afterPrint = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    root.dataset.docPaper = paper;

    function onAfterPrint() {
      afterPrint.current = true;
    }
    window.addEventListener("afterprint", onAfterPrint);

    function tryPrint() {
      if (afterPrint.current) return;
      if (attempts.current >= 2) return;
      attempts.current += 1;
      try {
        root.dataset.docPaper = paper;
        window.focus();
        window.print();
      } catch {
        /* blocked — Print button remains */
      }
    }

    // Wait two frames so the receipt layout is painted before the dialog.
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        window.setTimeout(tryPrint, delayMs);
      });
    });

    // Second chance if first fire was swallowed (common on slow paint).
    const retry = window.setTimeout(() => {
      if (!afterPrint.current) tryPrint();
    }, delayMs + 700);

    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(retry);
      // Leave dataset if DocPrintControls is still mounted for re-print.
    };
  }, [enabled, delayMs, paper]);

  return null;
}
