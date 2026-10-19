"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useEffect, type ReactNode } from "react";

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
  if (!document.body.classList.contains("pos-fs")) return;
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
 * Clears sticky POS fullscreen chrome (`body.pos-fs`) off POS/KDS routes.
 * Soft navigations + stacked router.refresh can leave the class on `body`,
 * which hides the sidebar / desk header until a hard refresh.
 */
export function DeskChromeGuard({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const onPos = isPosFullscreenRoute(pathname);

  // Before paint — avoid one-frame missing sidebar after soft nav.
  useLayoutEffect(() => {
    if (!onPos) clearPosFullscreenChrome();
  }, [onPos, pathname]);

  // Heal if something re-adds the class while we are not on POS/KDS.
  useEffect(() => {
    if (onPos) return;
    clearPosFullscreenChrome();
    const tick = window.setInterval(clearPosFullscreenChrome, 1500);
    const onShow = () => clearPosFullscreenChrome();
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [onPos]);

  return children ?? null;
}
