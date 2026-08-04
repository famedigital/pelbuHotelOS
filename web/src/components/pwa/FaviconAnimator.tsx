"use client";

import { BRAND_ICONS } from "@/lib/brand";
import { useEffect } from "react";

/**
 * Animated tab favicon. Renders the Pelbu brand mark to a canvas with a
 * rotating gold "loading" arc while the document loads, then settles to the
 * crisp static favicon. Works in Chromium/Firefox (dynamic favicon via data
 * URL); Safari ignores runtime favicon swaps and keeps the static PNG, which
 * is the correct graceful degradation.
 */

const SIZE = 64; // canvas render size (browser downscales to 16/32 in the tab)
const MARK_SRC = BRAND_ICONS.markLg;
const STATIC_SRC = BRAND_ICONS.favicon32;
const GOLD = "#d4a852";
const GOLD_TRACK = "rgba(184, 137, 44, 0.18)";
const COMMIT_INTERVAL_MS = 80; // ~12fps favicon updates — plenty, cheap
const SETTLE_DELAY_MS = 450; // let the arc finish a beat after load

export function FaviconAnimator() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let link = document.querySelector<HTMLLinkElement>("link#pelbu-favicon");
    if (!link) {
      link = document.createElement("link");
      link.id = "pelbu-favicon";
      link.rel = "icon";
      link.type = "image/png";
      // Appended last so browsers prefer it over the static <link>s.
      document.head.appendChild(link);
    }
    const iconLink = link;

    const img = new Image();
    let raf = 0;
    let loaded = false;
    let running = true;
    let lastCommit = 0;
    const startedAt = performance.now();

    const drawMark = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      const inset = SIZE * 0.16;
      ctx.drawImage(img, inset, inset, SIZE - inset * 2, SIZE - inset * 2);
    };

    const drawArc = (elapsed: number) => {
      const cx = SIZE / 2;
      const cy = SIZE / 2;
      const r = SIZE / 2 - 3;
      const head = (elapsed / 750) * Math.PI * 2;

      ctx.lineCap = "round";
      ctx.lineWidth = 4;

      ctx.strokeStyle = GOLD_TRACK;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = GOLD;
      ctx.beginPath();
      ctx.arc(cx, cy, r, head, head + Math.PI * 0.6);
      ctx.stroke();
    };

    const commit = () => {
      iconLink.href = canvas.toDataURL("image/png");
    };

    const settle = () => {
      running = false;
      cancelAnimationFrame(raf);
      // Hand back to the crisp static favicon asset.
      iconLink.href = STATIC_SRC;
    };

    const frame = (now: number) => {
      if (!running) return;
      if (now - lastCommit >= COMMIT_INTERVAL_MS) {
        drawMark();
        drawArc(now - startedAt);
        commit();
        lastCommit = now;
      }
      raf = requestAnimationFrame(frame);
    };

    img.onload = () => {
      loaded = true;
      if (reduceMotion) {
        drawMark();
        commit();
        return;
      }
      raf = requestAnimationFrame(frame);
      const stop = () => window.setTimeout(settle, SETTLE_DELAY_MS);
      if (document.readyState === "complete") {
        stop();
      } else {
        window.addEventListener("load", stop, { once: true });
      }
    };
    img.src = MARK_SRC;

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      if (loaded && iconLink.href.startsWith("data:")) {
        iconLink.href = STATIC_SRC;
      }
    };
  }, []);

  return null;
}
