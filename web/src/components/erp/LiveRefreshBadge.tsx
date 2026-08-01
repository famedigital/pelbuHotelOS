"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Polls a fingerprint endpoint and refreshes the route when the version moves.
 *
 * The endpoint must return `{ version: string }` for the active property.
 * Browser Realtime is intentionally avoided on desk (no service-role keys).
 */
export function LiveRefreshBadge({
  endpoint,
  intervalMs = 5000,
  title = "Polling for changes",
  className = "text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
  toastOnChange = true,
}: {
  endpoint: string;
  intervalMs?: number;
  title?: string;
  className?: string;
  /** Sonner toast when the fingerprint moves (poll substitute for Realtime). */
  toastOnChange?: boolean;
}) {
  const router = useRouter();
  const lastVersion = useRef<string | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(tick, intervalMs);
        return;
      }
      try {
        const res = await fetch(endpoint, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (!cancelled) {
            setLive(false);
            setError(true);
          }
          timer = setTimeout(tick, intervalMs * 2);
          return;
        }
        const body = (await res.json()) as { version?: string };
        const version = body.version ?? "";
        if (!cancelled) {
          setLive(true);
          setError(false);
          if (lastVersion.current !== null && lastVersion.current !== version) {
            if (toastOnChange) {
              toast.message("Desk updated", {
                description: "Refreshing room rack / board…",
                duration: 2200,
              });
            }
            router.refresh();
          }
          lastVersion.current = version;
        }
      } catch {
        if (!cancelled) {
          setLive(false);
          setError(true);
        }
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [endpoint, intervalMs, router, toastOnChange]);

  return (
    <span
      className={className}
      aria-live="polite"
      title={error ? "Live updates paused" : live ? title : "Connecting…"}
    >
      {error ? "Offline" : live ? "Live" : "…"}
    </span>
  );
}
