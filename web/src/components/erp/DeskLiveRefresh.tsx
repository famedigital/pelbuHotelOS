"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Keeps the desk inbox/KOT board + POS open-tickets drawer fresh without a
 * manual browser refresh. Desk-auth'd version poll (orders have no anon SELECT
 * — cannot use browser Realtime safely). Version fingerprint includes park,
 * void, settle, and tender changes via `/api/erp/kot-version`.
 */
export function DeskLiveRefresh({
  intervalMs = 4000,
  label = "Live",
}: {
  intervalMs?: number;
  /** Optional override for the live badge text when connected. */
  label?: string;
}) {
  const router = useRouter();
  const lastVersion = useRef<string | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState(false);
  const [parked, setParked] = useState<number | null>(null);

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
        const body = (await res.json()) as {
          version?: string;
          parked?: number;
        };
        const version = body.version ?? "";
        if (!cancelled) {
          setLive(true);
          setError(false);
          if (typeof body.parked === "number") setParked(body.parked);
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

  const connectedLabel =
    parked != null && parked > 0 ? `${label} · ${parked} parked` : label;

  return (
    <p
      className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase"
      aria-live="polite"
      title={
        error
          ? "Live updates paused"
          : live
            ? "Polling for kitchen / POS ticket changes"
            : "Connecting…"
      }
    >
      {error ? "Board offline" : live ? connectedLabel : "…"}
    </p>
  );
}
