"use client";

import React, { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SpotlightContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
  spotlightSize?: number;
  children: React.ReactNode;
}

/**
 * GPU-Accelerated Cursor Tracking Spotlight
 * Offloads coordinate updates directly to CSS variables to bypass React VDOM re-renders.
 */
export const SpotlightContainer: React.FC<SpotlightContainerProps> = ({
  spotlightColor = "rgba(124, 58, 237, 0.14)", // Laser Violet
  spotlightSize = 450,
  className,
  children,
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    containerRef.current.style.setProperty("--spotlight-x", `${x}px`);
    containerRef.current.style.setProperty("--spotlight-y", `${y}px`);
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative overflow-hidden transform-gpu will-change-transform",
        className
      )}
      style={
        {
          "--spotlight-color": spotlightColor,
          "--spotlight-size": `${spotlightSize}px`,
        } as React.CSSProperties
      }
      {...props}
    >
      {/* GPU Radial Spotlight Layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-10"
        style={{
          background: `radial-gradient(var(--spotlight-size) circle at var(--spotlight-x, 0px) var(--spotlight-y, 0px), var(--spotlight-color), transparent 80%)`,
        }}
      />
      {children}
    </div>
  );
};
