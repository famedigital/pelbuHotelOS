import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";

type MagneticOptions = {
  /** Max px pull toward cursor — Volaro CTAs feel ~6–10 */
  strength?: number;
};

/**
 * Soft cursor magnetism for primary CTAs (Volaro `.magnetic` buttons).
 * Returns ref + handlers; no-ops under prefers-reduced-motion / coarse pointer.
 */
export function useMagnetic<T extends HTMLElement = HTMLElement>(
  options: MagneticOptions = {},
): {
  ref: RefObject<T | null>;
  onMouseMove: (e: ReactMouseEvent<T>) => void;
  onMouseLeave: () => void;
} {
  const strength = options.strength ?? 8;
  const reduce = useReducedMotion();
  const ref = useRef<T | null>(null);
  const frame = useRef(0);

  const onMouseMove = useCallback(
    (e: ReactMouseEvent<T>) => {
      if (reduce) return;
      if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
        return;
      }
      const el = ref.current;
      if (!el) return;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        const tx = (x / (rect.width / 2)) * strength;
        const ty = (y / (rect.height / 2)) * strength;
        el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
      });
    },
    [reduce, strength],
  );

  const onMouseLeave = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate3d(0, 0, 0)";
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
