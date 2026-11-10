import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn.js";
import {
  readStillWaterColors,
  StillWaterEngine,
} from "../lib/stillWaterEngine.js";

export type StillWaterSurfaceProps = {
  className?: string;
  /** When false, never mount WebGL (CSS mesh only). Default true. */
  enabled?: boolean;
};

function mediaMatches(query: string): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(query).matches;
}

/**
 * L0 still water — calm = transparent (CSS mesh). Motion = local directional wake.
 * Lazy WebGL init on first pointer move; auto-disables if frames blow the desk budget.
 */
export function StillWaterSurface({
  className,
  enabled = true,
}: StillWaterSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  const gatedOff =
    !enabled ||
    Boolean(reduceMotion) ||
    mediaMatches("(prefers-reduced-motion: reduce)") ||
    mediaMatches("(prefers-reduced-transparency: reduce)") ||
    mediaMatches("(pointer: coarse)");

  useEffect(() => {
    if (gatedOff) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: StillWaterEngine | null = null;
    let painted = false;
    let disposed = false;

    const ensure = (): StillWaterEngine | null => {
      if (disposed || failed) return null;
      if (engine) return engine;
      try {
        engine = new StillWaterEngine(canvas, {
          onDisable: () => {
            if (!disposed) setFailed(true);
          },
        });
        engine.paintMesh(readStillWaterColors(document.documentElement));
        engine.resize();
        painted = true;
        return engine;
      } catch (err) {
        console.warn("[StillWaterSurface] WebGL2 unavailable", err);
        setFailed(true);
        return null;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const eng = ensure();
      if (!eng) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      // Last sample only — coalesced floods hurt FO desk GPUs
      eng.pushSample(e.clientX / w, e.clientY / h, false);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const eng = ensure();
      if (!eng) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      eng.pushSample(e.clientX / w, e.clientY / h, true);
    };
    const onLeave = () => engine?.clearPointer();
    const onResize = () => {
      if (!engine) return;
      engine.resize();
      if (!painted) return;
      engine.paintMesh(readStillWaterColors(document.documentElement));
    };
    const onVisibility = () => {
      if (document.hidden) {
        engine?.stop();
        engine?.clearPointer();
      }
    };

    const themeObs = new MutationObserver(() => {
      if (!engine) return;
      engine.paintMesh(readStillWaterColors(document.documentElement));
    });
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    // Lazy: listeners only — no WebGL until first move
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("blur", onLeave, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      themeObs.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      engine?.destroy();
      engine = null;
    };
  }, [gatedOff, failed]);

  if (gatedOff || failed) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-0 h-full w-full [transform:translateZ(0)]",
        className,
      )}
    />
  );
}
