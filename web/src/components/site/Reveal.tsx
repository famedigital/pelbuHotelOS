"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Delay in ms before adding the visible class. Use sparingly. */
  delayMs?: number;
  className?: string;
  /** Render as a different element (default: div). */
  as?: "div" | "section" | "li" | "article";
};

/**
 * Direction B scroll reveal — fade-up 8px, 400ms.
 *
 * Wraps children in a `.reveal` element that flips to `.is-visible` when the
 * first child enters the viewport. Respects prefers-reduced-motion via the
 * global CSS rule in globals.css (which forces .reveal to opacity:1).
 *
 * One direction, no stagger spam, no decorative animation — per brief §5.
 */
export function Reveal({
  children,
  delayMs = 0,
  className = "",
  as: Tag = "div",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            window.setTimeout(() => setVisible(true), delayMs);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delayMs]);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
