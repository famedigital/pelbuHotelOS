export type SfxKind = "keycard" | "register" | "audit";

let muted = false;
let ctx: AudioContext | null = null;

export function setSfxMuted(next: boolean) {
  muted = next;
}

export function isSfxMuted() {
  return muted;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch (err) {
    console.error("[sfx] AudioContext", err);
    return null;
  }
}

function beep(
  frequency: number,
  durationMs: number,
  type: OscillatorType,
  gain = 0.08,
  when = 0,
) {
  const ac = getCtx();
  if (!ac || muted) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

/** Sensory desk cues — synthesized so we don't ship binary assets. */
export function playSfx(kind: SfxKind) {
  if (muted) return;
  try {
    if (kind === "keycard") {
      // chk-tick — short mechanical encode click
      beep(1800, 35, "square", 0.05);
      beep(900, 45, "triangle", 0.04, 0.03);
      return;
    }
    if (kind === "register") {
      // cash drawer / till click
      beep(420, 40, "square", 0.06);
      beep(280, 70, "sawtooth", 0.035, 0.045);
      return;
    }
    // singing-bowl-ish audit chime
    beep(528, 420, "sine", 0.07);
    beep(792, 520, "sine", 0.045, 0.08);
    beep(1056, 620, "sine", 0.03, 0.16);
  } catch (err) {
    console.error("[sfx] play", kind, err);
  }
}
