"use client";

import { hasMobileBottomBar, hidesPublicChrome } from "@/lib/public-chrome";
import { cn } from "@/lib/utils";
import { ArrowUpIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Roughly one viewport of scrolling before the button is worth offering. */
const REVEAL_AFTER_PX = 700;

/**
 * Floating "back to top" control for the public site. Sits above the mobile
 * tab bar, and stays out of the way on routes that already own the bottom of
 * a small screen.
 */
export function BackToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > REVEAL_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (hidesPublicChrome(pathname)) return null;

  const scrollToTop = () => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    // Send the keyboard caret back to the top of the document too, otherwise
    // the next Tab resumes from wherever the reader had scrolled to.
    document.querySelector("header")?.focus?.();
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      // Kept out of the tab order while off-screen so it never becomes an
      // invisible focus stop, and hidden from screen readers for the same
      // reason — the browser's own Home key already covers that path.
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        "fixed right-4 z-30 inline-flex size-11 items-center justify-center rounded-full",
        "border border-border/70 bg-background/90 text-foreground shadow-lg backdrop-blur",
        "transition-[opacity,transform] duration-300 ease-out",
        "hover:border-sky-200 hover:bg-white hover:text-sky-700",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6 md:right-6",
        visible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
        hasMobileBottomBar(pathname) && "max-md:hidden",
      )}
    >
      <ArrowUpIcon className="size-5" aria-hidden />
    </button>
  );
}
