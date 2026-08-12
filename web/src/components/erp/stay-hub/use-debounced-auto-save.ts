"use client";

/**
 * Debounce changes and call save. Coalesces rapid keystrokes.
 * Status "saving" only when flush starts; success is silent (chip only).
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function useDebouncedAutoSave<T>(options: {
  /** Snapshot of editable state — change triggers debounce */
  value: T;
  /** Skip first snapshot after mount / booking switch */
  enabled: boolean;
  delayMs?: number;
  /** Stable serialize for comparison */
  serialize: (v: T) => string;
  save: (v: T) => Promise<{ ok: boolean; error?: string; message?: string }>;
  /** Unused for toast — success is silent; kept for call-site compat */
  successMessage?: string;
  /** When true, toast on success (default false — soft Saved chip only) */
  toastOnSuccess?: boolean;
  onStatus?: (s: "idle" | "saving" | "saved" | "error") => void;
}) {
  const {
    value,
    enabled,
    delayMs = 650,
    serialize,
    save,
    successMessage = "Saved",
    toastOnSuccess = false,
    onStatus,
  } = options;

  const lastSaved = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const skipFirst = useRef(true);

  useEffect(() => {
    if (!enabled) {
      lastSaved.current = null;
      skipFirst.current = true;
      return;
    }

    const key = serialize(value);
    if (skipFirst.current) {
      skipFirst.current = false;
      lastSaved.current = key;
      return;
    }
    if (key === lastSaved.current) return;

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      const toSave = value;
      const toKey = serialize(toSave);
      onStatusRef.current?.("saving");
      void (async () => {
        const result = await saveRef.current(toSave);
        if (result.ok) {
          lastSaved.current = toKey;
          onStatusRef.current?.("saved");
          if (toastOnSuccess) {
            toast.success(result.message ?? successMessage);
          }
          window.setTimeout(() => onStatusRef.current?.("idle"), 1800);
        } else {
          onStatusRef.current?.("error");
          toast.error(result.error ?? "Could not save");
        }
      })();
    }, delayMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, enabled, delayMs, serialize, successMessage, toastOnSuccess]);
}
