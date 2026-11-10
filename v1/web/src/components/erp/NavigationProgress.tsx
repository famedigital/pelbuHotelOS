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
        className="desk-nav-progress h-full bg-accent transition-[width] duration-[140ms] ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );

  const host = document.querySelector("[data-desk-root]") ?? document.body;
  return createPortal(bar, host);
}

/** Thin top bar on ERP route changes — complements sonner action toasts. */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
