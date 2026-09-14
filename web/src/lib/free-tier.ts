/**
 * Free-tier (Vercel Hobby + Supabase free) budget guards.
 *
 * Goals: keep FO usable, cut continuous API / function burn.
 * Override with env numbers when you move to paid plans.
 */

import { DEFAULT_PROPERTY_SLUG } from "@/lib/property";

/**
 * Conservative by default.
 * Set HOTELOS_PAID_TIER=1 (or legacy PELBU_PAID_TIER / NEXT_PUBLIC_*) when paid.
 */
export function isFreeTierMode(): boolean {
  const paid =
    process.env.HOTELOS_PAID_TIER === "1" ||
    process.env.HOTELOS_PAID_TIER === "true" ||
    process.env.PELBU_PAID_TIER === "1" ||
    process.env.PELBU_PAID_TIER === "true" ||
    process.env.PEL_PAID_TIER === "1" ||
    process.env.NEXT_PUBLIC_HOTELOS_PAID_TIER === "1" ||
    process.env.NEXT_PUBLIC_HOTELOS_PAID_TIER === "true" ||
    process.env.NEXT_PUBLIC_PELBU_PAID_TIER === "1" ||
    process.env.NEXT_PUBLIC_PELBU_PAID_TIER === "true";
  return !paid;
}

function numEnv(name: string, freeDefault: number, paidDefault: number): number {
  const raw = process.env[name]?.trim();
  if (raw && Number.isFinite(Number(raw))) return Math.max(1_000, Number(raw));
  return isFreeTierMode() ? freeDefault : paidDefault;
}

/** Calendar / FO board fingerprint poll (ms). Free: 15s; paid: 5s. */
export function deskPollMs(): number {
  return numEnv("NEXT_PUBLIC_DESK_POLL_MS", 15_000, 5_000);
}

/**
 * When the desk tab is hidden, poll much slower to protect Hobby invocations
 * and Supabase API/egress. Free: 90s; paid: 30s.
 */
export function deskHiddenPollMs(): number {
  return numEnv("NEXT_PUBLIC_DESK_HIDDEN_POLL_MS", 90_000, 30_000);
}

/** Full RSC safety refresh interval while FO boards are open (ms). */
export function deskSafetyRefreshMs(): number {
  return numEnv("NEXT_PUBLIC_DESK_SAFETY_REFRESH_MS", 300_000, 180_000);
}

/** Room rack calendar fingerprint (ms). Free: 15s; paid: 4s. */
export function calendarPollMs(): number {
  return numEnv("NEXT_PUBLIC_CALENDAR_POLL_MS", 15_000, 4_000);
}

/** Whether public marketing pages must stay fully dynamic (stale-cache kill-switch). */
export function publicForceDynamic(): boolean {
  return (
    process.env.PUBLIC_FORCE_DYNAMIC === "1" ||
    process.env.PUBLIC_FORCE_DYNAMIC === "true"
  );
}

/** Folio stale check (ms). Free: 30s; paid: 10s. */
export function folioPollMs(): number {
  return numEnv("NEXT_PUBLIC_FOLIO_POLL_MS", 30_000, 10_000);
}

/** KOT / live safety poll backup (ms). */
export function safetyPollMs(): number {
  return numEnv("NEXT_PUBLIC_SAFETY_POLL_MS", 90_000, 60_000);
}

/**
 * Hosts that map to the optional flagship property — from FLAGSHIP_HOSTS only.
 * Empty by default: localhost / *.vercel.app do NOT auto-map to one hotel.
 */
function flagshipHostsFromEnv(): Set<string> {
  const hosts = new Set<string>();
  const extra = process.env.FLAGSHIP_HOSTS?.split(",") ?? [];
  for (const h of extra) {
    const n = h.trim().toLowerCase();
    if (n) hosts.add(n);
  }
  return hosts;
}

export function isFlagshipHost(hostHeader: string | null): boolean {
  const host = (hostHeader ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
  if (!host) return false;
  return flagshipHostsFromEnv().has(host);
}

/** Optional UUID so middleware never hits DB for flagship. Set when known. */
export function flagshipPropertyIdFromEnv(): string | null {
  const id = process.env.FLAGSHIP_PROPERTY_ID?.trim();
  return id && id.length > 10 ? id : null;
}

export function flagshipSlug(): string {
  return process.env.FLAGSHIP_PROPERTY_SLUG?.trim() || DEFAULT_PROPERTY_SLUG;
}
