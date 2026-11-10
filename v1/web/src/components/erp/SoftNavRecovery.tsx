"use client";

import { useEffect } from "react";

function shouldHardReload(reason: string): boolean {
  const r = reason.toLowerCase();
  return (
    r.includes("loading chunk") ||
    r.includes("chunkloaderror") ||
    r.includes("failed to fetch") ||
    r.includes("dynamically imported module") ||
    r.includes("error loading RSC") ||
    r.includes("fetch failed")
  );
}

/**
 * After a Coolify cutover, soft navigations can keep a stale client bundle.
 * Reload once when chunk / RSC fetch fails so FO does not need a manual hard refresh.
 */
export function SoftNavRecovery() {
  useEffect(() => {
    let reloading = false;
    const reloadOnce = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      const msg = [
        event.message,
        event.error instanceof Error ? event.error.message : "",
        event.error instanceof Error ? event.error.name : "",
      ].join(" ");
      if (shouldHardReload(msg)) reloadOnce();
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg =
        reason instanceof Error
          ? `${reason.name} ${reason.message}`
          : String(reason ?? "");
      if (shouldHardReload(msg)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
