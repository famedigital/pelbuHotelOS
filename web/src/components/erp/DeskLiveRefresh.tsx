"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Keeps the desk inbox/KOT board fresh without a manual browser refresh.
 * Desk-auth'd version poll (orders have no anon SELECT — cannot use browser Realtime safely).
 */
export function DeskLiveRefresh({
  intervalMs = 4000,
}: {
  intervalMs?: number;
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
        const res = await fetch("/api/erp/kot-version", {
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
      if (!cancelled) {
        timer = setTimeout(tick, intervalMs);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, router]);

  return (
    <p
      className="text-[10px] font-medium tracking-[0.16em] text-muted uppercase"
      aria-live="polite"
      title={
        error
          ? "Live updates paused"
          : live
            ? "Polling for new kitchen tickets"
            : "Connecting…"
      }
    >
      {error ? "Board offline" : live ? "Live" : "…"}
    </p>
  );
}
