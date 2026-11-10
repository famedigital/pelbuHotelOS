"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** Show a loading toast while a server action is pending — dismiss on complete. */
export function usePendingFeedback(pending: boolean, label = "Working…") {
  const toastId = useRef<string | number | undefined>(undefined);

  useEffect(() => {
    if (pending) {
      toastId.current = toast.loading(label);
    } else if (toastId.current !== undefined) {
      toast.dismiss(toastId.current);
      toastId.current = undefined;
    }
  }, [pending, label]);
}
