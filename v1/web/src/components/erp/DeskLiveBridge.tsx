"use client";

import { useEffect } from "react";

export type DeskLiveEvent = {
  table: string;
  eventType: string;
  bookingId: string | null;
  folioId: string | null;
  id: string | null;
};

/**
 * One long-lived SSE from this Node process.
 * Boards and the open stay listen for `hotelos-desk` instead of each opening a stream.
 */
export function DeskLiveBridge() {
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      if (document.visibilityState === "hidden") return;
      es = new EventSource("/api/erp/desk-stream");
      es.addEventListener("ready", () => {
        window.dispatchEvent(new CustomEvent("hotelos-desk-ready"));
      });
      es.addEventListener("desk", (event) => {
        let detail: DeskLiveEvent | null = null;
        try {
          detail = JSON.parse((event as MessageEvent).data) as DeskLiveEvent;
        } catch {
          detail = null;
        }
        window.dispatchEvent(new CustomEvent("hotelos-desk", { detail }));
      });
      es.onerror = () => {
        es?.close();
        es = null;
        if (closed) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && !es) connect();
    };

    connect();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []);

  return null;
}
