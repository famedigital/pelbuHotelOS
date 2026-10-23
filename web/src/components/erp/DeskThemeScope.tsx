"use client";

import { parseDeskTheme, type DeskTheme } from "@/lib/desk-theme";
import { useEffect } from "react";

/** Mirrors the shell skin onto <html> so portaled dialogs follow the hotel. */
export function DeskThemeScope({ theme }: { theme: DeskTheme }) {
  useEffect(() => {
    const root = document.documentElement;
    const next = parseDeskTheme(theme);
    if (next === "dzong") delete root.dataset.deskTheme;
    else root.dataset.deskTheme = next;
    return () => {
      delete root.dataset.deskTheme;
    };
  }, [theme]);

  return null;
}
