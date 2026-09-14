"use client";

import { Button } from "@/components/ui/button";
import { MaximizeIcon, MinimizeIcon } from "lucide-react";
import { useEffect } from "react";

/**
 * True browser fullscreen for the POS surface.
 *
 * Calls `requestFullscreen()` on `document.documentElement` — the whole page,
 * not a nested card. Promoting the document root keeps the normal paint chain
 * (no black top-layer backdrop), lets the `.erp` theme apply, and gives a real
 * fullscreen with the OS chrome gone — which the previous CSS-only approach
 * never delivered.
 *
 * We *also* set `body.pos-fs` so the desk sidebar / header hide while we're in
 * fullscreen (the native API doesn't remove them, just escapes the window).
 *
 * Falls back gracefully where the Fullscreen API is missing (iOS Safari before
 * 16.4, locked webviews) — in that case the body class alone still expands the
 * POS surface to fill the viewport, which is the previous behaviour.
 */
export function PosFullscreenToggle({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  // Apply native fullscreen + body class together.
  useEffect(() => {
    if (active) {
      document.body.classList.add("pos-fs");
      if (typeof document !== "undefined") {
        const el = document.documentElement;
        const anyEl = el as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        const req = el.requestFullscreen?.bind(el) ?? anyEl.webkitRequestFullscreen?.bind(anyEl);
        if (req) {
          req().catch(() => {
            // Permission denied / not allowed — keep CSS-only mode.
          });
        }
      }
      return () => {
        document.body.classList.remove("pos-fs");
        if (typeof document !== "undefined" && document.fullscreenElement) {
          const doc = document as Document & {
            webkitExitFullscreen?: () => Promise<void>;
          };
          (document.exitFullscreen?.bind(document) ??
            doc.webkitExitFullscreen?.bind(doc))?.().catch(() => {});
        }
      };
    }
    return;
  }, [active]);

  // Keep `active` in sync if the user exits fullscreen via ESC or the browser
  // menu instead of the toggle button.
  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && active) {
        onChange(false);
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [active, onChange]);

  // Shift+F toggles, ESC exits (native ESC already exits fullscreen; this
  // catches the CSS-only fallback path).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && active) {
        event.preventDefault();
        onChange(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;
      if (typing) return;
      if (event.shiftKey && (event.key === "F" || event.key === "f")) {
        event.preventDefault();
        onChange(!active);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onChange]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9"
      onClick={() => onChange(!active)}
      aria-pressed={active}
      title={active ? "Exit fullscreen (Shift+F)" : "Fullscreen POS (Shift+F)"}
    >
      {active ? (
        <MinimizeIcon className="size-4" />
      ) : (
        <MaximizeIcon className="size-4" />
      )}
      <span className="hidden sm:inline">
        {active ? "Exit fullscreen" : "Fullscreen"}
      </span>
    </Button>
  );
}
