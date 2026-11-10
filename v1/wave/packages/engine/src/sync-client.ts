import { listPendingWal, markWalStatus } from "./wal-db";
import type { DeskSnapshot, WalLogEntry } from "./types";
import { isMoneySyncOp, isBrowserOnline } from "./types";

export interface SyncClientConfig {
  apiBaseUrl: string;
  getToken: () => string | null;
  onSnapshot?: (snap: DeskSnapshot) => void;
  onAck?: (opId: string) => void;
  onError?: (err: Error) => void;
}

export class DeskSyncClient {
  private ws: WebSocket | null = null;
  private cfg: SyncClientConfig;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(cfg: SyncClientConfig) {
    this.cfg = cfg;
  }

  async fetchSnapshot(propertyId: string): Promise<DeskSnapshot> {
    const res = await fetch(
      `${this.cfg.apiBaseUrl}/v1/desk/snapshot?propertyId=${encodeURIComponent(propertyId)}`,
      { headers: this.authHeaders() },
    );
    if (!res.ok) {
      throw new Error(`snapshot failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as DeskSnapshot;
  }

  connectWs(propertyId: string): void {
    if (typeof WebSocket === "undefined") return;
    const token = this.cfg.getToken();
    const url = new URL(this.cfg.apiBaseUrl.replace(/^http/, "ws") + "/v1/ws");
    url.searchParams.set("propertyId", propertyId);
    if (token) url.searchParams.set("token", token);
    this.ws = new WebSocket(url.toString());
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type: string;
          payload?: unknown;
        };
        if (msg.type === "snapshot" && msg.payload) {
          this.cfg.onSnapshot?.(msg.payload as DeskSnapshot);
        }
        if (msg.type === "ack" && msg.payload) {
          const { opId } = msg.payload as { opId: string };
          this.cfg.onAck?.(opId);
        }
      } catch (err) {
        this.cfg.onError?.(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    };
    this.ws.onerror = () =>
      this.cfg.onError?.(new Error("WebSocket error"));
  }

  startFlushLoop(ms = 2500): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      void this.flushPending();
    }, ms);
  }

  stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
    this.ws?.close();
    this.ws = null;
  }

  async flushPending(): Promise<void> {
    if (!isBrowserOnline()) return;
    let pending: WalLogEntry[] = [];
    try {
      pending = await listPendingWal();
    } catch (err) {
      console.error("[DeskSyncClient.flushPending] listPendingWal failed", err);
      this.cfg.onError?.(
        err instanceof Error ? err : new Error(String(err)),
      );
      return;
    }
    for (const entry of pending) {
      try {
        if (isMoneySyncOp(entry.opType) && !isBrowserOnline()) {
          await markWalStatus(
            entry.opId,
            "failed",
            "offline — money ops not flushed",
          );
          continue;
        }
        await markWalStatus(entry.opId, "syncing");
        const res = await fetch(`${this.cfg.apiBaseUrl}/v1/sync/replay`, {
          method: "POST",
          headers: {
            ...this.authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(entry),
        });
        if (!res.ok) {
          const text = await res.text();
          await markWalStatus(entry.opId, "failed", text);
          continue;
        }
        await markWalStatus(entry.opId, "acked");
        this.cfg.onAck?.(entry.opId);
      } catch (err) {
        await markWalStatus(
          entry.opId,
          "failed",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  private authHeaders(): Record<string, string> {
    const token = this.cfg.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
