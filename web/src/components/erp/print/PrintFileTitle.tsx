"use client";

import { useEffect } from "react";

/** Browser save-as-PDF uses the document title as the file name. */
export function PrintFileTitle({ title }: { title: string }) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    const onPrint = () => {
      document.title = title;
    };
    window.addEventListener("beforeprint", onPrint);
    return () => {
      window.removeEventListener("beforeprint", onPrint);
      document.title = previous;
    };
  }, [title]);
  return null;
}
