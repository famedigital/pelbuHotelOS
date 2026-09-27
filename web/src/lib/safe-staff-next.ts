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
  // Only staff portal destinations (bag QR lives under /staff/laundry/bags).
  if (path !== "/staff" && !path.startsWith("/staff/")) {
    return null;
  }
  // Cap length (token URLs can be long but not unbounded).
  if (path.length > 2000) return null;
  return path;
}

/**
 * POS register PWA may only continue to the sell screen.
 * Rejects every other desk path so this login cannot be used as an open redirect.
 */
export function safePosRegisterNextPath(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes("?") ||
    path.includes("#") ||
    /^\/[a-z]+:/i.test(path)
  ) {
    return null;
  }
  const base = path.replace(/\/+$/, "") || "/";
  if (base !== "/erp/pos") return null;
  return "/erp/pos";
}
