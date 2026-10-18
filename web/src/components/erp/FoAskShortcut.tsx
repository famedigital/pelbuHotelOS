"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true']"));
}

/**
 * FO speed keys: `/` or F2 → Ask · `N` → Reserve · `I` → Arrivals (instant CI).
 * Skips when focus is in an input (except bare `/` on Ask itself is handled there).
 */
export function FoAskShortcut() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const typing = isTypingTarget(event.target);

      if (event.key === "F2") {
        event.preventDefault();
        router.push("/erp/ask");
        return;
      }

      if (event.key === "/" && !typing) {
        event.preventDefault();
        if (pathname === "/erp/ask" || pathname?.startsWith("/erp/ask/")) {
          const el = document.getElementById("fo-ask-input");
          if (el instanceof HTMLInputElement) {
            el.focus();
            el.select();
          }
          return;
        }
        router.push("/erp/ask");
        return;
      }

      if (typing) return;

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        router.push("/erp/reserve");
        return;
      }

      if (event.key === "i" || event.key === "I") {
        event.preventDefault();
        router.push("/erp/arrivals");
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return null;
}
