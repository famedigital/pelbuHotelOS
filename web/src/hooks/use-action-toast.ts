"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

type ActionState = {
  ok?: boolean;
  error?: string | null;
  message?: string | null;
};

/**
 * Fires sonner toasts in response to an action state machine.
 *
 * - When `state.ok` becomes true → success toast (uses `state.message` or a
 *   fallback).
 * - When `state.error` becomes non-empty → error toast.
 *
 * Tracks the last-seen state with a ref so re-renders that don't change the
 * payload don't double-fire. Mounts cleanly (initial state does not fire).
 *
 * Keep the inline banners too — they're the no-JS fallback. This hook only
 * adds the toast affordance on top.
 */
export function useActionToast(
  state: ActionState,
  {
    successMessage,
    silentSuccess = false,
  }: { successMessage?: string; silentSuccess?: boolean } = {},
) {
  const lastSignature = useRef<string>("");

  useEffect(() => {
    const signature = JSON.stringify({
      ok: state.ok ?? false,
      error: state.error ?? null,
      message: state.message ?? null,
    });
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

    if (state.ok) {
      if (!silentSuccess) {
        toast.success(successMessage ?? state.message ?? "Saved");
      }
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state.ok, state.error, state.message, successMessage, silentSuccess]);
}
