"use client";

import * as React from "react";

/**
 * Returns `true` once the viewport matches the given media query (SSR-safe —
 * starts `false` and updates after mount). Use to switch between a desktop
 * rail layout and a mobile Sheet without rendering duplicate form fields.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
