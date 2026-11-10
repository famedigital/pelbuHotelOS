"use client";

import { useEffect, useRef } from "react";
import { getDeskApiBaseUrl, readV2DeskToken } from "@/lib/v2/desk-api";
import { refreshV2DeskEngine } from "@/lib/v2/rehydrate-engine";

/**
 * Optional WebSocket push: connects to `/v1/ws?token=` and re-hydrates the engine on each snapshot.
 * Disabled via NEXT_PUBLIC_V2_WS_REFRESH=0.
 */
export function V2DeskWsRefresh(): null {
  const triedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NEXT_PUBLIC_V2_WS_REFRESH === "0") return;
    if (triedRef.current) return;
    triedRef.current = true;

    let ws: WebSocket | null = null;
    let cancelled = false;

    const connect = () => {
      const token = readV2DeskToken();
      if (!token) return;
      const base = getDeskApiBaseUrl();
      const wsUrl = base.startsWith("https")
        ? `wss://${base.slice("https://".length)}`
        : `ws://${base.slice("http://".length)}`;
      const url = `${wsUrl}/v1/ws?token=${encodeURIComponent(token)}`;

      try {
        ws = new WebSocket(url);
      } catch (err) {
        console.error("[V2DeskWsRefresh] WebSocket ctor", err);
        return;
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string };
          if (msg.type === "snapshot") {
            void refreshV2DeskEngine().catch((err) => {
              console.error("[V2DeskWsRefresh] rehydrate failed", err);
            });
          }
        } catch (err) {
          console.error("[V2DeskWsRefresh] message parse", err);
        }
      };

      ws.onerror = () => {
        // Browsers do not expose useful error details — one toast per session max.
        console.warn("[V2DeskWsRefresh] socket error (check API / mixed content)");
      };

      ws.onclose = (ev) => {
        if (!cancelled && ev.code !== 1008) {
          // Soft backoff — optional refresh is best-effort only.
          window.setTimeout(() => {
            if (!cancelled) connect();
          }, 15000);
        }
      };
    };

    connect();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "hotel_os_v2_desk_jwt" || e.key === null) {
        ws?.close();
        connect();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "layout unmount");
      }
    };
  }, []);

  return null;
}
