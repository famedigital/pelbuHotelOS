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
    if (PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    void navigator.serviceWorker.register("/pelbu-sw.js", { scope: "/" });
  }, [pathname]);

  return null;
}
