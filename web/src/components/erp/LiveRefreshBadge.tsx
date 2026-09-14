"use client";

import {
  deskHiddenPollMs,
  deskPollMs,
  deskSafetyRefreshMs,
} from "@/lib/free-tier";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Fingerprint poll → route refresh. Free-tier slower to protect Vercel+Supabase.
 * Prefer onInvalidate (patch cache) over full router.refresh when provided.
 * Hidden tabs poll slowly; periodic safety full refresh heals rare drift.
 */
export function LiveRefreshBadge({
  endpoint,
  intervalMs,
  title = "Polling for changes",
  className = "text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
  toastOnChange = true,
  onInvalidate,
}: {
  endpoint: string;
  intervalMs?: number;
  title?: string;
  className?: string;
  toastOnChange?: boolean;
  /** When set, called instead of router.refresh (fallback to refresh on throw). */
  onInvalidate?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const lastVersion = useRef<string | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState(false);
  const pollMs = intervalMs ?? deskPollMs();
  const hiddenMs = deskHiddenPollMs();
  const safetyMs = deskSafetyRefreshMs();
  const onInvalidateRef = useRef(onInvalidate);
  onInvalidateRef.current = onInvalidate;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let safetyTimer: ReturnType<typeof setInterval> | undefined;

    async function applyChange() {
      const custom = onInvalidateRef.current;
      if (custom) {
        try {
          await Promise.resolve(custom());
          return;
        } catch {
          // fall through to full refresh
        }
      }
      router.refresh();
    }

    async function tick() {
      const hidden = document.visibilityState === "hidden";
      if (hidden) {
        timer = setTimeout(tick, hiddenMs);
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
            void applyChange();
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
    safetyTimer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      router.refresh();
    }, safetyMs);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (safetyTimer) clearInterval(safetyTimer);
    };
  }, [endpoint, pollMs, hiddenMs, safetyMs, router, toastOnChange]);

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
