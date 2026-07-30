"use client";

import { useEffect } from "react";

export function WorkPwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/work-sw.js", { scope: "/erp/" });
  }, []);

  return null;
}
