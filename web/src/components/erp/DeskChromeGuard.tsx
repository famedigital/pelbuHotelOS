"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Clears sticky POS fullscreen chrome (`body.pos-fs`) when the desk shell mounts.
 * Leaving POS without teardown can hide the sidebar until a full reload.
 */
export function DeskChromeGuard({ children }: { children?: ReactNode }) {
  useEffect(() => {
    document.body.classList.remove("pos-fs");
  }, []);
  return children ?? null;
}
