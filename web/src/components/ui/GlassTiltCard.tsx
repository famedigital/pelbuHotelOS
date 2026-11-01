"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type GlowColor = "gold" | "brand" | "emerald" | "ruby";

interface GlassTiltCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: GlowColor;
}

const glowStyles: Record<GlowColor, string> = {
  brand: "hover:border-blue-500/40 hover:shadow-blue-500/20",
  gold: "hover:border-amber-500/40 hover:shadow-amber-500/20",
  emerald: "hover:border-emerald-500/40 hover:shadow-emerald-500/20",
  ruby: "hover:border-red-500/40 hover:shadow-red-500/20",
};

/**
 * Interactive glass card with subtle 3D tilt for booking / KPI / marketing.
 * Honors prefers-reduced-motion (no tilt).
 */
export function GlassTiltCard({
  children,
  className = "",
  glowColor = "brand",
}: GlassTiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setRotate({
      x: ((y - centerY) / centerY) * -8,
      y: ((x - centerX) / centerX) * 8,
    });
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.18,
    });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: reduceMotion
          ? "translateZ(0)"
          : `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) translateZ(0)`,
        transition: "transform 0.15s ease-out, box-shadow 0.2s ease",
      }}
      className={`glass-card relative overflow-hidden transition-all duration-300 ${glowStyles[glowColor]} ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.4) 0%, transparent 65%)`,
          opacity: glare.opacity,
        }}
        aria-hidden
      />
      {children}
    </div>
  );
}
