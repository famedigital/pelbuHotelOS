/**
 * Safe relative post-login paths for staff portal (open-redirect resistant).
 * Allows query strings (bag scan tokens live in `?t=`).
 */
export function safeStaffNextPath(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let path = raw.trim();
  if (!path) return null;
  // Reject absolute / protocol-relative / backslash tricks.
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.includes("\0") ||
    /^\/[a-z]+:/i.test(path)
  ) {
    return null;
  }
  // Only staff portal, POS kiosk, or desk destinations.
  if (
    path !== "/staff" &&
    !path.startsWith("/staff/") &&
    path !== "/pos" &&
    !path.startsWith("/pos/") &&
    path !== "/erp" &&
    !path.startsWith("/erp/")
  ) {
    return null;
  }
  // Cap length (token URLs can be long but not unbounded).
  if (path.length > 2000) return null;
  return path;
}
