"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type KotVersionResponse = {
  version: string;
  count: number;
  parked: number;
  online: number;
  counts?: {
    new?: number;
    preparing?: number;
    ready?: number;
  };
};

export type KotNotifierStatus = "idle" | "live" | "offline";

export type KotAlertKind = "new_ticket" | "ready_ticket" | "change" | "test";

export type KotBoardCounts = {
  new: number;
  preparing: number;
  ready: number;
};

/**
 * Kitchen / Pass live poller (1.5s default).
 * Diffs version + status counts for the right siren; optional speech alerts.
 */
export function useKotNotifier({
  intervalMs = 1500,
  speak = true,
  /** Pass/Expo: alert only when Ready count increases. */
  preferReadyAlert = false,
}: {
  intervalMs?: number;
  speak?: boolean;
  preferReadyAlert?: boolean;
} = {}) {
  const [status, setStatus] = useState<KotNotifierStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [armed, setArmed] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [lastChangedAt, setLastChangedAt] = useState<number>(() => Date.now());
  const [lastAlertKind, setLastAlertKind] = useState<KotAlertKind | null>(null);
  const [counts, setCounts] = useState<KotBoardCounts>({
    new: 0,
    preparing: 0,
    ready: 0,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastVersionRef = useRef<string | null>(null);
  const lastCountsRef = useRef<KotBoardCounts | null>(null);
  const mutedRef = useRef(false);
  const speakRef = useRef(speak);
  const preferReadyRef = useRef(preferReadyAlert);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);
  useEffect(() => {
    preferReadyRef.current = preferReadyAlert;
  }, [preferReadyAlert]);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  }, []);

  const speakAlert = useCallback((kind: KotAlertKind) => {
    if (!speakRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const phrase =
        kind === "ready_ticket"
          ? "Order ready for service. Order ready."
          : kind === "new_ticket"
            ? "New kitchen order. New kitchen order."
            : kind === "test"
              ? "Kitchen sound test. Alert system ready."
              : "Kitchen board updated.";
      const u = new SpeechSynthesisUtterance(phrase);
      u.rate = 0.9;
      u.pitch = 1;
      u.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const en =
        voices.find((v) => /^en/i.test(v.lang) && /Google|Microsoft|Samantha|Daniel/i.test(v.name)) ??
        voices.find((v) => /^en/i.test(v.lang));
      if (en) u.voice = en;
      window.speechSynthesis.speak(u);
    } catch {
      /* best-effort */
    }
  }, []);

  /**
   * Kitchen-grade siren: ~2.8s of square sweeps + sawtooth stabs, then voice.
   * Loud by design — lower the TV volume if needed, not the other way around.
   */
  const playAlarm = useCallback(
    (kind: KotAlertKind = "new_ticket") => {
      if (mutedRef.current && kind !== "test") return;
      const ctx = ensureCtx();
      if (!ctx) return;
      try {
        if (ctx.state === "suspended") void ctx.resume();
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.connect(ctx.destination);

        // Soft pulse when kitchen advances its own tickets (not a new POS fire).
        if (kind === "change") {
          master.gain.value = 0.28;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = 740;
          g.gain.setValueAtTime(0.0001, now);
          g.gain.exponentialRampToValueAtTime(0.85, now + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
          osc.connect(g);
          g.connect(master);
          osc.start(now);
          osc.stop(now + 0.22);
          setLastAlertKind(kind);
          return;
        }

        master.gain.value = kind === "test" ? 0.5 : 0.65;

        const sweeps = [
          { t: 0.0, a: 680, b: 980 },
          { t: 0.55, a: 720, b: 1100 },
          { t: 1.15, a: 640, b: 1050 },
        ];
        for (const s of sweeps) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(s.a, now + s.t);
          osc.frequency.linearRampToValueAtTime(s.b, now + s.t + 0.28);
          osc.frequency.linearRampToValueAtTime(s.a, now + s.t + 0.48);
          g.gain.setValueAtTime(0.0001, now + s.t);
          g.gain.exponentialRampToValueAtTime(0.95, now + s.t + 0.04);
          g.gain.setValueAtTime(0.95, now + s.t + 0.4);
          g.gain.exponentialRampToValueAtTime(0.0001, now + s.t + 0.52);
          osc.connect(g);
          g.connect(master);
          osc.start(now + s.t);
          osc.stop(now + s.t + 0.55);
        }

        const stabs = [1.75, 1.95, 2.15, 2.4];
        for (const t of stabs) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.value = kind === "ready_ticket" ? 560 : 920;
          g.gain.setValueAtTime(0.0001, now + t);
          g.gain.exponentialRampToValueAtTime(1, now + t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.16);
          osc.connect(g);
          g.connect(master);
          osc.start(now + t);
          osc.stop(now + t + 0.18);
        }

        window.setTimeout(() => speakAlert(kind), 1000);
        setLastAlertKind(kind);
      } catch {
        /* ignore audio errors */
      }
    },
    [ensureCtx, speakAlert],
  );

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

      const nextCounts: KotBoardCounts = {
        new: data.counts?.new ?? 0,
        preparing: data.counts?.preparing ?? 0,
        ready: data.counts?.ready ?? 0,
      };

      const prev = lastVersionRef.current;
      const prevCounts = lastCountsRef.current;
      if (prev !== null && prev !== data.version) {
        setLastChangedAt(Date.now());
        const newUp = prevCounts != null && nextCounts.new > prevCounts.new;
        const readyUp =
          prevCounts != null && nextCounts.ready > prevCounts.ready;

        if (preferReadyRef.current) {
          // Pass / Expo TV: only care when kitchen marks Ready.
          if (readyUp) playAlarm("ready_ticket");
        } else {
          // Kitchen TV: blare on new tickets; short change tone for other moves.
          if (newUp) playAlarm("new_ticket");
          else if (readyUp) {
            /* optional soft — skip so own Ready doesn't spam kitchen */
          } else {
            // Status advance / park — soft pulse only (no voice)
            playAlarm("change");
          }
        }
      }

      lastVersionRef.current = data.version;
      lastCountsRef.current = nextCounts;
      setCounts(nextCounts);
      setNewCount(data.count ?? 0);
      setReadyCount(nextCounts.ready);
    } catch {
      setStatus("offline");
    }
  }, [playAlarm]);

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

  // Soft "change" alarm is too loud with square waves — add quiet path.
  // Override playAlarm internally for change: one short pulse only.

  const armAudio = useCallback(() => {
    const ctx = ensureCtx();
    if (ctx?.state === "suspended") void ctx.resume();
    setArmed(true);
    setMuted(false);
    mutedRef.current = false;
    try {
      window.speechSynthesis?.getVoices();
    } catch {
      /* ignore */
    }
    playAlarm("test");
  }, [ensureCtx, playAlarm]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      if (!next) {
        const ctx = ensureCtx();
        if (ctx?.state === "suspended") void ctx.resume();
        setArmed(true);
      }
      return next;
    });
  }, [ensureCtx]);

  const testSound = useCallback(() => {
    mutedRef.current = false;
    setMuted(false);
    setArmed(true);
    playAlarm("test");
  }, [playAlarm]);

  return {
    status,
    muted,
    armed,
    armAudio,
    toggleMute,
    testSound,
    newCount,
    readyCount,
    lastChangedAt,
    lastAlertKind,
    counts,
    playAlarm,
  };
}
