"use client";

import {
  DESK_OFFLINE_QUEUED_KINDS,
  enqueueDeskOffline,
  listDeskOffline,
  removeDeskOffline,
  type DeskOfflineItem,
  type DeskOfflineKind,
} from "@/lib/desk/offline-queue";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";

/**
 * Desk strip: shows IndexedDB offline queue count and lets staff park drafts
 * when the network drops. Sync is manual dismiss after re-entry online —
 * money posts are never queued here.
 */
export function DeskOfflineQueueStrip({
  defaultKind = "hold_draft",
}: {
  defaultKind?: DeskOfflineKind;
}) {
  const [items, setItems] = useState<DeskOfflineItem[]>([]);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listDeskOffline());
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    void refresh();
    const onOnline = () => {
      setOnline(true);
      void refresh();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  async function parkDraft() {
    try {
      await enqueueDeskOffline(defaultKind, {
        note: "Manual park from desk",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        at: new Date().toISOString(),
      });
      setMessage(`Queued ${DESK_OFFLINE_QUEUED_KINDS[defaultKind]}.`);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not queue offline.");
    }
  }

  async function clearItem(id: string) {
    await removeDeskOffline(id);
    await refresh();
  }

  if (online && items.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-foreground">
          {online ? "Online" : "Offline"} · {items.length} queued draft
          {items.length === 1 ? "" : "s"} (holds / book / POS park only — no
          folio money)
        </p>
        <div className="flex flex-wrap gap-2">
          {!online ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void parkDraft()}>
              Park {defaultKind.replace("_", " ")}
            </Button>
          ) : null}
        </div>
      </div>
      {message ? (
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{item.kind}</span>
              <span>{new Date(item.createdAt).toLocaleString("en-BT")}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => void clearItem(item.id)}
              >
                Clear
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
