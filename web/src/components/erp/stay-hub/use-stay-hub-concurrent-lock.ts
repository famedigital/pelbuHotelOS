/**
 * Soft multi-machine StayHub lock — eZee Net Locks lite.
 * Local: BroadcastChannel + localStorage (same browser).
 * Cross-desk: DB lease via claimStayLease (staff machine pair).
 * Not a hard block — FO can force with note.
 */
"use client";

import {
  claimStayLease,
  releaseStayLease,
} from "@/app/actions/erp-stay-lease";
import { useEffect, useRef, useState } from "react";

const CHANNEL = "pelbu-stay-hub-edit-lock";
const STORAGE_PREFIX = "pelbu-stay-lock:";
const HEARTBEAT_MS = 8_000;
const STALE_MS = 20_000;

type LockPayload = {
  bookingId: string;
  clientId: string;
  at: number;
  label: string;
};

function storageKey(bookingId: string) {
  return `${STORAGE_PREFIX}${bookingId}`;
}

function readStored(bookingId: string): LockPayload | null {
  try {
    const raw = localStorage.getItem(storageKey(bookingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockPayload;
    if (!parsed?.bookingId || !parsed.clientId || !parsed.at) return null;
    if (Date.now() - parsed.at > STALE_MS) {
      localStorage.removeItem(storageKey(bookingId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(payload: LockPayload) {
  try {
    localStorage.setItem(storageKey(payload.bookingId), JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

function clearStored(bookingId: string, clientId: string) {
  try {
    const cur = readStored(bookingId);
    if (cur?.clientId === clientId) {
      localStorage.removeItem(storageKey(bookingId));
    }
  } catch {
    /* ignore */
  }
}

function clientIdOnce(): string {
  if (typeof window === "undefined") return "ssr";
  const key = "pelbu-stay-lock-client";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return `t-${Date.now()}`;
  }
}

export type StayHubConcurrentLock = {
  /** Another tab or desk holds this booking. */
  peerHint: string | null;
  holding: boolean;
  forceTakeover: (note?: string) => Promise<void>;
};

/**
 * Announce open StayHub for bookingId; report peer if another client holds it.
 */
export function useStayHubConcurrentLock(
  bookingId: string | null | undefined,
  open: boolean,
): StayHubConcurrentLock {
  const [peerHint, setPeerHint] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const clientIdRef = useRef<string>("");

  useEffect(() => {
    if (!clientIdRef.current) clientIdRef.current = clientIdOnce();
  }, []);

  useEffect(() => {
    if (!open || !bookingId) {
      setPeerHint(null);
      setHolding(false);
      return;
    }

    const clientId = clientIdRef.current || clientIdOnce();
    clientIdRef.current = clientId;
    const label = "Another desk tab";
    let cancelled = false;

    const existing = readStored(bookingId);
    if (existing && existing.clientId !== clientId) {
      setPeerHint(
        `${existing.label || label} may be editing this stay. Save carefully or refresh after they close.`,
      );
    }

    const claimLocal = (): LockPayload => {
      const payload: LockPayload = {
        bookingId,
        clientId,
        at: Date.now(),
        label: "This desk session",
      };
      writeStored(payload);
      setHolding(true);
      return payload;
    };

    claimLocal();

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (ev: MessageEvent) => {
        const data = ev.data as
          | { type: "claim" | "release" | "ping"; payload: LockPayload }
          | undefined;
        if (!data?.payload || data.payload.bookingId !== bookingId) return;
        if (data.payload.clientId === clientId) return;
        if (data.type === "release") {
          setPeerHint((prev) =>
            prev?.includes("desk tab") || prev?.includes("workstation")
              ? null
              : prev,
          );
          return;
        }
        setPeerHint(
          `${data.payload.label || label} also has this stay open. Coordinate before posting money.`,
        );
      };
      channel.postMessage({
        type: "claim",
        payload: {
          bookingId,
          clientId,
          at: Date.now(),
          label: "Another workstation",
        } satisfies LockPayload,
      });
    } catch {
      channel = null;
    }

    async function renewServer(force = false, forceNote?: string) {
      try {
        const res = await claimStayLease(bookingId!, clientId, {
          force,
          forceNote,
        });
        if (cancelled) return;
        if (!res.ok) return;
        if (res.peerLabel && !res.holding) {
          setPeerHint(
            `${res.peerLabel} has this stay open on another machine. Force only with a manager note.`,
          );
          setHolding(false);
        } else if (res.holding) {
          setHolding(true);
          if (!force) {
            setPeerHint((prev) =>
              prev && prev.includes("another machine") ? null : prev,
            );
          } else {
            setPeerHint(null);
          }
        }
      } catch {
        /* offline — local lock still helps same browser */
      }
    }

    void renewServer(false);

    const heartbeat = window.setInterval(() => {
      claimLocal();
      void renewServer(false);
      try {
        channel?.postMessage({
          type: "ping",
          payload: {
            bookingId,
            clientId,
            at: Date.now(),
            label: "Another workstation",
          } satisfies LockPayload,
        });
      } catch {
        /* ignore */
      }
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      clearStored(bookingId, clientId);
      setHolding(false);
      void releaseStayLease(bookingId, clientId);
      try {
        channel?.postMessage({
          type: "release",
          payload: {
            bookingId,
            clientId,
            at: Date.now(),
            label,
          } satisfies LockPayload,
        });
        channel?.close();
      } catch {
        /* ignore */
      }
    };
  }, [open, bookingId]);

  async function forceTakeover(note?: string) {
    if (!bookingId) return;
    const clientId = clientIdRef.current || clientIdOnce();
    const res = await claimStayLease(bookingId, clientId, {
      force: true,
      forceNote: note ?? "Manager forced stay lease",
    });
    if (res.ok && res.holding) {
      setPeerHint(null);
      setHolding(true);
    }
  }

  return { peerHint, holding, forceTakeover };
}
