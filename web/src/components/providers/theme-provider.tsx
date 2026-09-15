"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";
import { allThemeValues, DEFAULT_THEME } from "@/lib/themes-config";

/**
 * Root theme provider — locks public site to Ocean Breeze light.
 * ERP desk keeps its own `.erp` semantic overrides in globals.css.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      themes={allThemeValues}
      defaultTheme={DEFAULT_THEME}
      forcedTheme={DEFAULT_THEME}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
