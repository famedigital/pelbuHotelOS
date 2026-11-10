"use client";

import {
  classifyFreshness,
  getDeskReadCache,
  isDeskReadCacheEnabled,
  purgeExpiredDeskReadCache,
  setDeskReadCache,
  type DeskCacheTtl,
} from "@/lib/desk/desk-read-cache";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type DeskSwrSource = "none" | "cache" | "network";

export type UseDeskSwrResult<T> = {
  data: T | null;
  source: DeskSwrSource;
  syncing: boolean;
  error: string | null;
  freshness: "fresh" | "stale" | "expired" | "none";
  refresh: () => void;
};

let purgedThisSession = false;

/**
 * Stale-while-revalidate for desk FO reads.
 * Paints IndexedDB immediately when present, then revalidates.
 */
export function useDeskSwr<T>(args: {
  key: string | null;
  propertyId: string | null;
  ttl: DeskCacheTtl;
  fetcher: (signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
  /** Toast when network replaces different hash. Default true. */
  toastOnSync?: boolean;
  label?: string;
}): UseDeskSwrResult<T> {
  const {
    key,
    propertyId,
    ttl,
    fetcher,
    enabled = true,
    toastOnSync = true,
    label = "Desk",
  } = args;

  const [data, setData] = useState<T | null>(null);
  const [source, setSource] = useState<DeskSwrSource>("none");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<
    "fresh" | "stale" | "expired" | "none"
  >("none");
  const [tick, setTick] = useState(0);
  const hashRef = useRef<string | null>(null);
  const lastToastAt = useRef(0);

  useEffect(() => {
    if (!enabled || !key || !propertyId || !isDeskReadCacheEnabled()) {
      return;
    }
    let cancelled = false;
    const ac = new AbortController();

    async function run() {
      if (!purgedThisSession) {
        purgedThisSession = true;
        void purgeExpiredDeskReadCache();
      }

      setError(null);
      const cached = await getDeskReadCache<T>(key!, propertyId!);
      if (cancelled) return;

      if (cached) {
        const f = classifyFreshness(cached, ttl.softMs);
        if (f !== "expired") {
          setData(cached.payload);
          setSource("cache");
          setFreshness(f);
          hashRef.current = cached.payloadHash;
        }
      }

      setSyncing(true);
      const toastId = `desk-sync-${key}`;
      if (toastOnSync && cached) {
        toast.loading(`Syncing ${label}…`, { id: toastId, duration: 8_000 });
      }

      try {
        const next = await fetcher(ac.signal);
        if (cancelled || ac.signal.aborted) return;
        const saved = await setDeskReadCache({
          key: key!,
          propertyId: propertyId!,
          payload: next,
          hardMs: ttl.hardMs,
        });
        setData(next);
        setSource("network");
        setFreshness("fresh");
        const nextHash = saved?.payloadHash ?? null;
        const changed = nextHash != null && nextHash !== hashRef.current;
        hashRef.current = nextHash;
        if (toastOnSync) {
          const now = Date.now();
          if (cached && changed && now - lastToastAt.current > 3_000) {
            lastToastAt.current = now;
            toast.success(`${label} synced · just now`, { id: toastId });
          } else {
            toast.dismiss(toastId);
          }
        }
      } catch (err) {
        if (cancelled || ac.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : "Could not sync desk data.";
        setError(msg);
        if (toastOnSync && cached) {
          toast.message(`Offline · showing last saved ${label.toLowerCase()}`, {
            id: toastId,
          });
        } else if (toastOnSync) {
          toast.dismiss(toastId);
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
      ac.abort();
    };
    // fetcher identity: callers should stabilize or accept re-runs on tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, propertyId, enabled, tick, ttl.softMs, ttl.hardMs, label, toastOnSync]);

  return {
    data,
    source,
    syncing,
    error,
    freshness,
    refresh: () => setTick((n) => n + 1),
  };
}
