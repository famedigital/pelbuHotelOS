/**
 * Routes that opt out of the shared public chrome (mobile tab bar, back to
 * top). Staff-facing surfaces run their own shells, and checkout owns the
 * bottom of the screen with its own sticky action bar.
 */
export const PUBLIC_CHROME_HIDDEN_PREFIXES = [
  "/erp",
  "/staff",
  "/login",
  "/agents/portal",
  "/agents/app",
  "/agents/login",
  "/pay",
  "/laundry",
  "/book",
] as const;

export function hidesPublicChrome(pathname: string): boolean {
  return PUBLIC_CHROME_HIDDEN_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

/**
 * Routes that already park something at the bottom of a small screen — the
 * menu board keeps a sticky cart there when items are selected (immersive
 * mode also hides the tab bar while scrolling). Desktop has room for both.
 */
const MOBILE_BOTTOM_BAR_PREFIXES = ["/menu"] as const;

export function hasMobileBottomBar(pathname: string): boolean {
  return MOBILE_BOTTOM_BAR_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
