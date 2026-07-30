"use client";

import { useEffect } from "react";

/**
 * Fades out and removes the SSR `BrandSplash` once the window has loaded.
 * The splash node is static server HTML, so removing it from the DOM here is
 * safe — React never re-renders it.
 */

const MIN_VISIBLE_MS = 650; // avoid a jarring flash on fast loads
const FADE_MS = 500; // must match the CSS transition on #pelbu-splash

export function SplashController() {
  useEffect(() => {
    const el = document.getElementById("pelbu-splash");
    if (!el) return;

    if (el.getAttribute("data-state") === "off") {
      el.remove();
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const minVisible = reduceMotion ? 0 : MIN_VISIBLE_MS;
    const shownAt = performance.now();
    let removeTimer = 0;

    const dismiss = () => {
      const wait = Math.max(0, minVisible - (performance.now() - shownAt));
      window.setTimeout(() => {
        el.setAttribute("data-state", "hide");
        removeTimer = window.setTimeout(
          () => el.remove(),
          reduceMotion ? 0 : FADE_MS,
        );
      }, wait);
    };

    if (document.readyState === "complete") {
      dismiss();
    } else {
      window.addEventListener("load", dismiss, { once: true });
    }

    return () => {
      window.removeEventListener("load", dismiss);
      window.clearTimeout(removeTimer);
    };
  }, []);

  return null;
}
