"use client";

import { useEffect } from "react";

export function MenuPrintAutoPrint({ enabled }: { enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => {
      window.print();
    }, 400);
    return () => window.clearTimeout(t);
  }, [enabled]);
  return null;
}
