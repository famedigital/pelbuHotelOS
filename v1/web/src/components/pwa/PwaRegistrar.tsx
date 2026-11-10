"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const PRIVATE_PREFIXES = [
  "/erp",
  "/staff",
  "/agents/app",
  "/agents/portal",
  "/login",
  "/pay",
];

export function PwaRegistrar() {
  const pathname = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (
      process.env.NODE_ENV !== "production" ||
      PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ) {
      if (process.env.NODE_ENV !== "production") {
        void navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .catch(() => undefined);
      }
      return;
    }
  }, [pathname]);

  return null;
}
