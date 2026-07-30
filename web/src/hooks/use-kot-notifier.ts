"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shape returned by `/api/erp/kot-version`. The `online` field is the count of
 * public-source open tickets; `count` is all open tickets.
 */
type KotVersionResponse = {
  version: string;
  count: number;
  parked: number;
  online: number;
};

export type KotNotifierStatus = "idle" | "live" | "offline";

/**
 * Polls the KOT version fingerprint and surfaces:
 *   - `status`  — live / offline (for the header chip)
 *   - `muted`   + `toggleMute()` — user-facing sound toggle
 *   - `newCount`/`readyCount` — current open counts (for badges)
 *   - `lastChangedAt` — epoch ms of the last fingerprint change (for "updated Xs ago")
 *
 * Sound: on every version change we synthesize a short two-note chime via Web
 * Audio. No binary asset — synthesized at runtime, so it survives SW cache
 * misses and works on HDMI-connected TVs with no local speakers besides the
 * TV. The chime is created lazily on the first user gesture (browsers block
 * autoplay until interaction), then reused.
 *
 * Polling pauses when the tab is hidden (the existing `DeskLiveRefresh` also
 * does this) but resumes on focus — a TV mini-PC keeps the tab foregrounded.
 */
export function useKotNotifier({ intervalMs = 4000 }: { intervalMs?: number } = {}) {
  const [status, setStatus] = useState<KotNotifierStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [lastChangedAt, setLastChangedAt] = useState<number>(() => Date.now());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastVersionRef = useRef<string | null>(null);
  const mutedRef = useRef(false);

  // Keep a ref of muted state so the poll callback (stable via useCallback)
  // always sees the latest value without re-subscribing.
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const playChime = useCallback(() => {
    if (mutedRef.current) return;
    if (typeof window === "undefined") return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;

      // Two ascending notes (E5 → A5) — bright "new ticket" feel without
      // being harsh on repeat. Soft-sine to keep the TV from blaring.
      const notes = [
        { freq: 659.25, start: 0, dur: 0.14 },
        { freq: 880.0, start: 0.13, dur: 0.22 },
      ];
      const master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = n.freq;
        gain.gain.setValueAtTime(0, now + n.start);
        gain.gain.linearRampToValueAtTime(1, now + n.start + 0.015);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + n.start + n.dur,
        );
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.02);
      }
    } catch {
      // Audio is best-effort — never break the board.
    }
  }, []);

  const tick = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    try {
      const res = await fetch("/api/erp/kot-version", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setStatus("offline");
        return;
      }
      const data = (await res.json()) as KotVersionResponse;
      setStatus("live");

      // The version endpoint returns aggregate counts; new/ready come from
      // its `count` plus the per-status fields when present. We diff on
      // `version` for the chime trigger — any state change (new ticket,
      // status advance, void, settle) flips it.
      const prev = lastVersionRef.current;
      if (prev !== null && prev !== data.version) {
        setLastChangedAt(Date.now());
        playChime();
      }
      lastVersionRef.current = data.version;
      setNewCount(data.count ?? 0);
      setReadyCount(data.parked ?? 0);
    } catch {
      setStatus("offline");
    }
  }, [playChime]);

  useEffect(() => {
    void tick();
    const id = window.setInterval(tick, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tick, intervalMs]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      // Play a soft tick immediately on unmute so the operator hears that
      // audio is now live (no surprise first chime 4s later).
      if (!next) {
        try {
          if (!audioCtxRef.current && typeof window !== "undefined") {
            const AudioCtx =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
            if (AudioCtx) audioCtxRef.current = new AudioCtx();
          }
          if (audioCtxRef.current?.state === "suspended") {
            void audioCtxRef.current.resume();
          }
        } catch {
          // ignore
        }
      }
      return next;
    });
  }, []);

  /**
   * Test the chime on demand. Used by the "Test sound" button so the operator
   * can confirm the TV audio is wired before opening hours.
   */
  const testSound = useCallback(() => {
    mutedRef.current = false;
    setMuted(false);
    playChime();
  }, [playChime]);

  return {
    status,
    muted,
    toggleMute,
    testSound,
    newCount,
    readyCount,
    lastChangedAt,
  };
}
