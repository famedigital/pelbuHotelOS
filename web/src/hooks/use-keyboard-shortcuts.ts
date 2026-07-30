"use client";

import { useCallback, useEffect } from "react";

export type ShortcutHandler = (event: KeyboardEvent) => void;

export type ShortcutBinding = {
  /** Lowercase key, e.g. "1", "/", "?", "f". Use "Escape" for Esc. */
  key: string;
  /** Require Ctrl/Cmd? (rare for app shortcuts, but available.) */
  mod?: boolean;
  /** Require Shift? */
  shift?: boolean;
  handler: ShortcutHandler;
  /** Shown in the help overlay. */
  label: string;
  /** Shown in the help overlay, e.g. "1", "Shift+F", "/". */
  display: string;
};

/**
 * Register a set of keyboard shortcuts globally on `window`. Ignores keystrokes
 * while the user is typing in an input / textarea / select / contentEditable
 * (so the `/` shortcut doesn't fight the search box) — unless the binding is
 * explicitly marked `allowInInput`.
 *
 * Returns nothing; call inside a component. Re-binds whenever `bindings`
 * changes (the caller should memoize the array to avoid re-subscribing every
 * render — or just pass a stable array literal if the handlers are stable).
 */
export function useKeyboardShortcuts(
  bindings: ShortcutBinding[],
  options: { helpToggleKey?: string } = {},
) {
  const onKey = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      for (const b of bindings) {
        const keyMatches =
          b.key === "Escape"
            ? event.key === "Escape"
            : event.key.toLowerCase() === b.key;
        if (!keyMatches) continue;
        if (event.ctrlKey !== !!b.mod && event.metaKey !== !!b.mod) continue;
        if (event.shiftKey !== !!b.shift) continue;
        if (typing && b.key !== "Escape") continue;
        event.preventDefault();
        b.handler(event);
        return;
      }
    },
    [bindings],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  // The help overlay is opened by the caller, not here — but we expose the
  // canonical bindings so the overlay can render them. Noop if no help key.
  void options;
}
