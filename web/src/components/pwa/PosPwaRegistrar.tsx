"use client";

import { useEffect } from "react";

/** POS home-screen app. Scope stays on /erp/pos so it does not become the desk PWA. */
export function PosPwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) =>
          Promise.all(
            regs
              .filter((r) => r.scope.includes("/erp/pos"))
              .map((r) => r.unregister()),
          ),
        )
        .catch(() => undefined);
      return;
    }
    void navigator.serviceWorker.register("/pos-sw.js", {
      scope: "/erp/pos/",
    });
  }, []);

  return null;
}
