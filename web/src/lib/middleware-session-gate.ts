/**
 * Pure session-gate helpers for Next middleware.
 * Kept free of next/server so node:test can cover login loops.
 */

export type ErpCredentialGateInput = {
  deskPinConfigured: boolean;
  isProduction: boolean;
  hasValidDeskPinCookie: boolean;
  hasSupabaseSessionCookie: boolean;
};

/**
 * Whether middleware should let the request past the /erp login redirect.
 * Mirrors desk dual-auth: shared PIN (when allowed) OR staff Supabase session.
 */
export function erpCredentialsPresent(input: ErpCredentialGateInput): boolean {
  if (!input.deskPinConfigured) {
    // Dev open-desk when PIN is unset; production still accepts staff Auth.
    if (!input.isProduction) return true;
    return input.hasSupabaseSessionCookie;
  }
  return input.hasValidDeskPinCookie || input.hasSupabaseSessionCookie;
}

/**
 * After a timed-out / failed middleware getUser(), discard Set-Cookie mutations.
 * Applying them is what clears sb-* cookies and creates login loops.
 */
export function shouldApplyMiddlewareAuthCookies(refreshCompleted: boolean): boolean {
  return refreshCompleted;
}
