"use client";

import { deskPollMs } from "@/lib/free-tier";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Fingerprint poll → route refresh. Free-tier slower to protect Vercel+Supabase.
 * Skips network while the tab is hidden.
 */
export function LiveRefreshBadge({
  endpoint,
  intervalMs,
  title = "Polling for changes",
  className = "text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
  toastOnChange = true,
}: {
  endpoint: string;
  intervalMs?: number;
  title?: string;
  className?: string;
  toastOnChange?: boolean;
}) {
  const router = useRouter();
  const lastVersion = useRef<string | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState(false);
  const pollMs = intervalMs ?? deskPollMs();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(tick, pollMs);
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
          timer = setTimeout(tick, pollMs * 2);
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
      if (!cancelled) timer = setTimeout(tick, pollMs);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [endpoint, pollMs, router, toastOnChange]);

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
