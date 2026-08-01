"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    setProgress(20);
    const mid = window.setTimeout(() => setProgress(70), 80);
    const done = window.setTimeout(() => {
      setProgress(100);
      window.setTimeout(() => setVisible(false), 180);
    }, 220);
    return () => {
      window.clearTimeout(mid);
      window.clearTimeout(done);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 bg-transparent"
      aria-hidden
    >
      <div
        className="h-full bg-accent transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/** Thin top bar on ERP route changes — complements sonner action toasts. */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
