"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * POS / desk inbox live badge. Push via KOT SSE (no 2s Vercel poll).
 * On order change → debounced router.refresh(). Safety: 60s version poll.
 */
export function DeskLiveRefresh({
  label = "Live",
  safetyPollMs = 60_000,
}: {
  label?: string;
  /** Backup poll only — keep high to protect Vercel limits. */
  safetyPollMs?: number;
}) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [error, setError] = useState(false);
  const [parked, setParked] = useState<number | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let safetyTimer: ReturnType<typeof setInterval> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        if (!cancelled) router.refresh();
      }, 250);
    };

    const pullParkedBadge = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/erp/kot-version", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const body = (await res.json()) as { parked?: number };
        if (!cancelled) {
          setError(false);
          if (typeof body.parked === "number") setParked(body.parked);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };

    const connect = () => {
      if (cancelled) return;
      es = new EventSource("/api/erp/kot/stream");
      es.addEventListener("ready", () => {
        if (!cancelled) {
          setLive(true);
          setError(false);
        }
        void pullParkedBadge();
      });
      es.addEventListener("kot", () => {
        if (!cancelled) {
          setLive(true);
          setError(false);
        }
        scheduleRefresh();
        void pullParkedBadge();
      });
      es.addEventListener("reconnect", () => {
        if (!cancelled) {
          setLive(true);
          setError(false);
        }
        es?.close();
        es = null;
        if (!cancelled) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 200);
        }
      });
      es.onerror = () => {
        if (!cancelled) {
          setLive(false);
          setError(true);
        }
        es?.close();
        es = null;
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 2_500);
        }
      };
    };

    connect();
    safetyTimer = setInterval(() => {
      void pullParkedBadge();
      if (document.visibilityState === "visible") scheduleRefresh();
    }, safetyPollMs);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        void pullParkedBadge();
        scheduleRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (safetyTimer) clearInterval(safetyTimer);
      document.removeEventListener("visibilitychange", onVis);
      es?.close();
    };
  }, [router, safetyPollMs]);

  const connectedLabel =
    parked != null && parked > 0 ? `${label} · ${parked} parked` : label;

  return (
    <p
      className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase"
      aria-live="polite"
      title={
        error
          ? "Live updates reconnecting"
          : live
            ? "Push updates (kitchen / POS tickets)"
            : "Connecting…"
      }
    >
      {error ? "Reconnecting…" : live ? connectedLabel : "…"}
    </p>
  );
}
