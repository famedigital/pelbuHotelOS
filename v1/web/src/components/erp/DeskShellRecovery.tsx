"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function skipsDeskShell(path: string): boolean {
  if (!path.startsWith("/erp")) return true;
  if (
    path === "/erp/login" ||
    path.startsWith("/erp/login/") ||
    path === "/erp/pos/login" ||
    path.startsWith("/erp/pos/login/") ||
    path === "/erp/kds" ||
    path.startsWith("/erp/kds/") ||
    path.startsWith("/erp/menu/print/")
  ) {
    return true;
  }
  return (
    /\/print\/?$/.test(path) ||
    /\/receipt\/?$/.test(path) ||
    /\/statement\/?$/.test(path) ||
    /\/slip\/?$/.test(path)
  );
}

/**
 * Login soft-navigates inside the shell-less layout, so the board paints
 * with no menu until a manual refresh. Reload once when the chrome is missing.
 */
export function DeskShellRecovery() {
  const pathname = usePathname();

  useEffect(() => {
    if (skipsDeskShell(pathname)) return;
    if (document.querySelector("[data-slot='desk-top-chrome']")) {
      sessionStorage.removeItem("desk-shell-recover");
      return;
    }
    const key = "desk-shell-recover";
    if (sessionStorage.getItem(key) === pathname) return;
    sessionStorage.setItem(key, pathname);
    window.location.replace(pathname + window.location.search);
  }, [pathname]);

  return null;
}
