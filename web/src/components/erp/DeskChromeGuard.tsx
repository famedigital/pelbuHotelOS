"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

function isPosFullscreenRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/erp/pos" ||
    pathname.startsWith("/erp/pos/") ||
    pathname === "/erp/kds" ||
    pathname.startsWith("/erp/kds/")
  );
}

function clearPosFullscreenChrome() {
  if (typeof document === "undefined") return;
  document.body.classList.remove("pos-fs");
  if (document.fullscreenElement) {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
    };
    (document.exitFullscreen?.bind(document) ??
      doc.webkitExitFullscreen?.bind(doc))?.().catch(() => {});
  }
}

/**
 * Clears sticky POS fullscreen chrome (`body.pos-fs`) when leaving POS/KDS.
 * Soft navigations can leave the class on `body`, which hides the sidebar
 * and desk header until a hard refresh.
 */
export function DeskChromeGuard({ children }: { children?: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (isPosFullscreenRoute(pathname)) return;
    clearPosFullscreenChrome();
  }, [pathname]);

  // Also clear on bfcache restore / tab focus (SPA soft-nav edge cases).
  useEffect(() => {
    const onShow = () => {
      if (!isPosFullscreenRoute(pathname)) clearPosFullscreenChrome();
    };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [pathname]);

  return children ?? null;
}
