"use client";

import { useEffect } from "react";

/**
 * Fades out the SSR `BrandSplash` once the window has loaded by flipping
 * `data-splash` on `<html>`. Never mutates or removes the splash node itself
 * — React owns that DOM and removing it causes insertBefore/removeChild
 * NotFoundError cascades.
 */

const MIN_VISIBLE_MS = 650; // avoid a jarring flash on fast loads

export function SplashController() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-splash") !== "on") return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const minVisible = reduceMotion ? 0 : MIN_VISIBLE_MS;
    const shownAt = performance.now();
    let fadeTimer = 0;

    const dismiss = () => {
      const wait = Math.max(0, minVisible - (performance.now() - shownAt));
      fadeTimer = window.setTimeout(() => {
        root.setAttribute("data-splash", "done");
      }, wait);
    };

    if (document.readyState === "complete") {
      dismiss();
    } else {
      window.addEventListener("load", dismiss, { once: true });
    }

    return () => {
      window.removeEventListener("load", dismiss);
      window.clearTimeout(fadeTimer);
    };
  }, []);

  return null;
}
