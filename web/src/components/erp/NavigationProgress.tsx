"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setVisible(true);
    setProgress(12);
    const mid = window.setTimeout(() => setProgress(72), 120);
    const done = window.setTimeout(() => {
      setProgress(100);
      window.setTimeout(() => setVisible(false), 280);
    }, 420);
    return () => {
      window.clearTimeout(mid);
      window.clearTimeout(done);
    };
  }, [pathname, searchParams]);

  if (!mounted || !visible) return null;

  const bar = (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-1 bg-transparent"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-label="Loading page"
    >
      <div
        className="h-full bg-citrus shadow-[0_0_8px_rgba(245,158,11,0.55)] transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );

  return createPortal(bar, document.body);
}

/** Thin top bar on ERP route changes — complements sonner action toasts. */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
