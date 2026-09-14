"use client";

import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LaundryLiveRefresh() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let stream: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      stream = new EventSource("/api/laundry/stream");
      stream.addEventListener("ready", () => setConnected(true));
      stream.addEventListener("laundry", () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 250);
      });
      stream.addEventListener("reconnect", () => {
        setConnected(true);
        stream?.close();
        stream = null;
        if (!stopped) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 200);
        }
      });
      stream.onerror = () => {
        setConnected(false);
        stream?.close();
        stream = null;
        if (!stopped) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 2_500);
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stream?.close();
    };
  }, [router]);
  return (
    <Badge variant={connected ? "default" : "outline"}>
      {connected ? "Live" : "Reconnecting…"}
    </Badge>
  );
}
