"use client";

import { useEffect, useRef } from "react";

/**
 * Opens the browser print dialog after paint (post-settle receipt).
 * Retries once if the first call was too early / ignored.
 */
export function AutoPrintOnLoad({
  enabled = true,
  delayMs = 80,
}: {
  enabled?: boolean;
  delayMs?: number;
}) {
  const attempts = useRef(0);
  const afterPrint = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    function onAfterPrint() {
      afterPrint.current = true;
    }
    window.addEventListener("afterprint", onAfterPrint);

    function tryPrint() {
      if (afterPrint.current) return;
      if (attempts.current >= 2) return;
      attempts.current += 1;
      try {
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
    };
  }, [enabled, delayMs]);

  return null;
}
