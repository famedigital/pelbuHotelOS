/**
 * Desk live sync — SSE outbox stream with poll fallback, multi-tab BroadcastChannel,
 * and visibility-aware backoff. Keeps FO boards fresh without thrashing renders.
 */
import { apiAbsoluteUrl, sessionPropertyId } from "./api";
import { getQueryClient } from "./query";

const TAB_CHANNEL = "hos-v2-desk-live";
const STORAGE_CURSOR = "hos_v2_live_cursor";

export type LiveStatus = "idle" | "connecting" | "live" | "poll" | "offline";

export type LiveOutboxEvent = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  propertyId: string;
  seq: number;
  at: string;
  payload: Record<string, unknown>;
};

export type LiveSnapshot = {
  status: LiveStatus;
  cursor: number;
  lastEventAt: string | null;
  lastEventType: string | null;
  lastError: string | null;
  eventsReceived: number;
  mode: "sse" | "poll" | "none";
};

type Listener = (snap: LiveSnapshot) => void;
type EventHandler = (ev: LiveOutboxEvent, source: "sse" | "poll" | "tab") => void;

let status: LiveStatus = "idle";
let cursor = 0;
let lastEventAt: string | null = null;
let lastEventType: string | null = null;
let lastError: string | null = null;
let eventsReceived = 0;
let mode: LiveSnapshot["mode"] = "none";
let started = false;
let es: EventSource | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let tabChannel: BroadcastChannel | null = null;
let visible = typeof document === "undefined" ? true : document.visibilityState === "visible";

const listeners = new Set<Listener>();
const eventHandlers = new Set<EventHandler>();
const seenIds = new Set<string>();

function snap(): LiveSnapshot {
  return {
    status,
    cursor,
    lastEventAt,
    lastEventType,
    lastError,
    eventsReceived,
    mode,
  };
}

function notify(): void {
  const s = snap();
  for (const fn of listeners) fn(s);
}

function setStatus(next: LiveStatus): void {
  if (status === next) return;
  status = next;
  notify();
}

function rememberCursor(seq: number): void {
  if (seq <= cursor) return;
  cursor = seq;
  try {
    localStorage.setItem(STORAGE_CURSOR, String(cursor));
  } catch {
    /* private mode */
  }
}

function markSeen(id: string): boolean {
  if (seenIds.has(id)) return false;
  seenIds.add(id);
  if (seenIds.size > 800) {
    const drop = [...seenIds].slice(0, 200);
    for (const d of drop) seenIds.delete(d);
  }
  return true;
}

function invalidateForEvent(ev: LiveOutboxEvent): void {
  const qc = getQueryClient();
  const t = ev.type.toLowerCase();
  if (t.includes("rate") || t.includes("room") || t.includes("inventory")) {
    void qc.invalidateQueries({ queryKey: ["rates"] });
    void qc.invalidateQueries({ queryKey: ["settings"] });
  }
  if (t.includes("folio") || t.includes("payment") || t.includes("till") || t.includes("finance")) {
    void qc.invalidateQueries({ queryKey: ["finance"] });
    void qc.invalidateQueries({ queryKey: ["till"] });
  }
  if (t.includes("booking") || t.includes("stay") || t.includes("reservation") || t.includes("check")) {
    void qc.invalidateQueries({ queryKey: ["reservations"] });
  }
  if (t.includes("hk") || t.includes("housekeep") || t.includes("room.status")) {
    void qc.invalidateQueries({ queryKey: ["housekeeping"] });
  }
}

function ingest(ev: LiveOutboxEvent, source: "sse" | "poll" | "tab"): void {
  if (!markSeen(ev.id)) return;
  rememberCursor(ev.seq);
  lastEventAt = ev.at;
  lastEventType = ev.type;
  eventsReceived += 1;
  notify();
  invalidateForEvent(ev);
  for (const fn of eventHandlers) {
    try {
      fn(ev, source);
    } catch (err) {
      console.error("[live-sync] handler failed", err);
    }
  }
  if (source !== "tab" && tabChannel) {
    try {
      tabChannel.postMessage({ kind: "outbox", event: ev });
    } catch (err) {
      console.warn("[live-sync] tab broadcast failed", err);
    }
  }
}

async function pollOnce(): Promise<void> {
  if (!visible) return;
  try {
    const url = apiAbsoluteUrl("/v1/outbox");
    url.searchParams.set("propertyId", sessionPropertyId());
    url.searchParams.set("since", String(cursor));
    url.searchParams.set("limit", "80");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url.toString(), { signal: controller.signal }).finally(
      () => clearTimeout(timer),
    );
    if (!res.ok) throw new Error(`outbox ${res.status}`);
    const body = (await res.json()) as {
      events: LiveOutboxEvent[];
      cursor?: number;
    };
    mode = "poll";
    setStatus("poll");
    lastError = null;
    reconnectAttempt = 0;
    for (const ev of body.events ?? []) ingest(ev, "poll");
    if (typeof body.cursor === "number" && body.cursor > cursor) {
      rememberCursor(body.cursor);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastError = msg;
    setStatus("offline");
    console.warn("[live-sync] poll failed", { err: msg });
  }
}

function schedulePoll(delayMs: number): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    void pollOnce().finally(() => {
      const next =
        status === "offline"
          ? Math.min(30_000, 2_000 * 2 ** Math.min(reconnectAttempt++, 4))
          : visible
            ? 4_000
            : 20_000;
      schedulePoll(next);
    });
  }, delayMs);
}

function stopSse(): void {
  if (es) {
    es.close();
    es = null;
  }
}

function startSse(): void {
  if (typeof EventSource === "undefined") {
    mode = "poll";
    setStatus("poll");
    schedulePoll(0);
    return;
  }
  stopSse();
  setStatus("connecting");
  const url = apiAbsoluteUrl("/v1/live/stream");
  url.searchParams.set("propertyId", sessionPropertyId());
  url.searchParams.set("since", String(cursor));
  const source = new EventSource(url.toString());
  es = source;

  source.addEventListener("hello", () => {
    mode = "sse";
    setStatus("live");
    lastError = null;
    reconnectAttempt = 0;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  });

  source.addEventListener("outbox", (msg) => {
    try {
      const ev = JSON.parse((msg as MessageEvent).data) as LiveOutboxEvent;
      ingest(ev, "sse");
      setStatus("live");
    } catch (err) {
      console.error("[live-sync] bad SSE payload", err);
    }
  });

  source.addEventListener("ping", () => {
    if (status !== "live") setStatus("live");
  });

  source.onerror = () => {
    stopSse();
    lastError = "SSE disconnected";
    setStatus("offline");
    const delay = Math.min(20_000, 1_200 * 2 ** Math.min(reconnectAttempt++, 4));
    /* Fall back to poll while SSE recovers. */
    mode = "poll";
    schedulePoll(400);
    window.setTimeout(() => {
      if (!started || !visible) return;
      startSse();
    }, delay);
  };
}

function onVisibility(): void {
  visible = document.visibilityState === "visible";
  if (visible) {
    if (mode === "sse" || status === "offline" || status === "idle") {
      startSse();
    } else {
      void pollOnce();
    }
  } else {
    /* Keep a slow poll; drop SSE to free sockets when tab is backgrounded. */
    stopSse();
    schedulePoll(12_000);
  }
}

function ensureTabChannel(): void {
  if (typeof BroadcastChannel === "undefined") return;
  if (tabChannel) return;
  tabChannel = new BroadcastChannel(TAB_CHANNEL);
  tabChannel.onmessage = (msg: MessageEvent) => {
    const data = msg.data as
      | { kind: "outbox"; event: LiveOutboxEvent }
      | { kind: "fo-patch"; revision: number; at: string }
      | undefined;
    if (!data) return;
    if (data.kind === "outbox") {
      ingest(data.event, "tab");
    }
    if (data.kind === "fo-patch") {
      for (const fn of eventHandlers) {
        try {
          fn(
            {
              id: `tab-fo-${data.revision}`,
              type: "desk.fo.patched",
              aggregateType: "desk",
              aggregateId: sessionPropertyId(),
              propertyId: sessionPropertyId(),
              seq: cursor,
              at: data.at,
              payload: { revision: data.revision },
            },
            "tab",
          );
        } catch (err) {
          console.error("[live-sync] fo-patch handler failed", err);
        }
      }
    }
  };
}

export function getLiveSnapshot(): LiveSnapshot {
  return snap();
}

export function subscribeLiveSync(fn: Listener): () => void {
  listeners.add(fn);
  fn(snap());
  return () => {
    listeners.delete(fn);
  };
}

export function onLiveEvent(fn: EventHandler): () => void {
  eventHandlers.add(fn);
  return () => {
    eventHandlers.delete(fn);
  };
}

/** Publish FO mutation so sibling tabs refresh selectors. */
export function publishFoTabPatch(revision: number): void {
  if (!tabChannel) ensureTabChannel();
  try {
    tabChannel?.postMessage({
      kind: "fo-patch",
      revision,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[live-sync] fo tab patch failed", err);
  }
}

export function startLiveSync(): () => void {
  if (started) return () => undefined;
  started = true;
  try {
    const saved = Number(localStorage.getItem(STORAGE_CURSOR) ?? "0");
    if (Number.isFinite(saved) && saved > 0) cursor = saved;
  } catch {
    /* ignore */
  }
  ensureTabChannel();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", () => {
    setStatus("connecting");
    startSse();
  });
  window.addEventListener("offline", () => {
    stopSse();
    setStatus("offline");
  });
  if (navigator.onLine) startSse();
  else setStatus("offline");

  return () => {
    started = false;
    stopSse();
    if (pollTimer) clearTimeout(pollTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    tabChannel?.close();
    tabChannel = null;
    setStatus("idle");
    mode = "none";
  };
}
