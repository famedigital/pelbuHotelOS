"use client";

import { useEffect } from "react";

export function WorkPwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Dev HMR + service workers fight over Next chunks and cause
    // “module factory is not available” after hot reloads.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) =>
          Promise.all(
            regs
              .filter((r) => r.scope.includes("/erp"))
              .map((r) => r.unregister()),
          ),
        )
        .catch(() => undefined);
      return;
    }
    void navigator.serviceWorker.register("/work-sw.js", { scope: "/erp/" });
  }, []);

  return null;
}
