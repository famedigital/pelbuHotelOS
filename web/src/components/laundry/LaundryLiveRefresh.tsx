"use client";

import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LaundryLiveRefresh() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const stream = new EventSource("/api/laundry/stream");
    let timer: ReturnType<typeof setTimeout> | null = null;
    stream.addEventListener("ready", () => setConnected(true));
    stream.addEventListener("laundry", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    });
    stream.onerror = () => setConnected(false);
    return () => {
      if (timer) clearTimeout(timer);
      stream.close();
    };
  }, [router]);
  return (
    <Badge variant={connected ? "default" : "outline"}>
      {connected ? "Live" : "Reconnecting…"}
    </Badge>
  );
}
