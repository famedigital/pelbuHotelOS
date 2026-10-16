/**
 * Desk session surface metrics — % of FO navigation that stays on StayView / Hub / POS.
 * Client-only; aggregates in sessionStorage for training / product telemetry.
 */

export type DeskSurface =
  | "stayview"
  | "hub"
  | "pos"
  | "night_close"
  | "settings"
  | "other";

const STORAGE_KEY = "hotel_os_desk_surface_v1";

export type AssistMetricKey =
  | "assist_drafts"
  | "assist_confirms"
  | "briefing_views";

export type DeskSurfaceCounters = Record<DeskSurface, number> & {
  startedAt: string;
  assist_drafts?: number;
  assist_confirms?: number;
  briefing_views?: number;
};

function empty(): DeskSurfaceCounters {
  return {
    stayview: 0,
    hub: 0,
    pos: 0,
    night_close: 0,
    settings: 0,
    other: 0,
    assist_drafts: 0,
    assist_confirms: 0,
    briefing_views: 0,
    startedAt: new Date().toISOString(),
  };
}

export function recordAssistMetric(key: AssistMetricKey): void {
  if (typeof window === "undefined") return;
  const next = readDeskSurfaceCounters();
  next[key] = (next[key] ?? 0) + 1;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function classifyDeskPathname(
  pathname: string,
  search: string,
): DeskSurface {
  const p = pathname.replace(/\/$/, "") || "/";
  const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  if (q.has("booking") || q.has("step")) return "hub";
  if (p === "/erp/stayview" || p === "/erp/today") return "stayview";
  if (p.startsWith("/erp/calendar")) return "stayview";
  if (p.startsWith("/erp/pos")) return "pos";
  if (p.startsWith("/erp/night-audit")) return "night_close";
  if (p.startsWith("/erp/settings")) return "settings";
  return "other";
}

export function readDeskSurfaceCounters(): DeskSurfaceCounters {
  if (typeof window === "undefined") return empty();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as DeskSurfaceCounters;
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

export function recordDeskSurfaceVisit(
  pathname: string,
  search = "",
): DeskSurfaceCounters {
  if (typeof window === "undefined") return empty();
  const surface = classifyDeskPathname(pathname, search);
  const next = readDeskSurfaceCounters();
  next[surface] += 1;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

/** Share of hits on StayView + Hub + POS (primary redesign surfaces). */
export function primarySurfaceShare(c: DeskSurfaceCounters): number {
  const total =
    c.stayview + c.hub + c.pos + c.night_close + c.settings + c.other;
  if (total <= 0) return 1;
  return (c.stayview + c.hub + c.pos) / total;
}
