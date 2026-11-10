/** Hotel gate + staff/portal sessions (exclusive per role). */

import { notifyPropertyChanged } from "./api";

const HOTEL_TOKEN = "hos.v2.hotel.token";
const HOTEL_PROPERTY = "hos.v2.hotel.property";
const PORTAL_TOKEN = "hos.v2.portal.token";
const PORTAL_META = "hos.v2.portal.meta";

export type SessionProperty = { id: string; slug: string; name: string };

export type PortalMeta = {
  role: "agent" | "guide" | "driver";
  loginCode: string;
  displayName: string;
  subjectId: string;
  homeRoute: string;
};

export function writeHotelGate(token: string, property: SessionProperty): void {
  sessionStorage.setItem(HOTEL_TOKEN, token);
  sessionStorage.setItem(HOTEL_PROPERTY, JSON.stringify(property));
  localStorage.setItem("hos.v2.propertyId", property.id);
  localStorage.setItem("hos.v2.propertySlug", property.slug);
  // Existing hotels must never re-trigger the new-tenant setup wizard.
  localStorage.setItem("hos_hotel_onboarded", "true");
  localStorage.setItem("hos_hotel_onboard_dismissed", "true");
  notifyPropertyChanged();
}

export function readHotelToken(): string | null {
  return sessionStorage.getItem(HOTEL_TOKEN);
}

export function readHotelProperty(): SessionProperty | null {
  const raw = sessionStorage.getItem(HOTEL_PROPERTY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionProperty;
  } catch {
    return null;
  }
}

export function clearHotelGate(): void {
  sessionStorage.removeItem(HOTEL_TOKEN);
  sessionStorage.removeItem(HOTEL_PROPERTY);
}

export function writePortalSession(
  token: string,
  property: SessionProperty,
  meta: PortalMeta,
): void {
  sessionStorage.setItem(PORTAL_TOKEN, token);
  sessionStorage.setItem(PORTAL_META, JSON.stringify({ ...meta, property }));
  localStorage.setItem("hos.v2.propertyId", property.id);
  localStorage.setItem("hos.v2.propertySlug", property.slug);
  notifyPropertyChanged();
}

export function readPortalToken(): string | null {
  return sessionStorage.getItem(PORTAL_TOKEN);
}

export function readPortalMeta(): (PortalMeta & { property?: SessionProperty }) | null {
  const raw = sessionStorage.getItem(PORTAL_META);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalMeta & { property?: SessionProperty };
  } catch {
    return null;
  }
}

export function clearPortalSession(): void {
  sessionStorage.removeItem(PORTAL_TOKEN);
  sessionStorage.removeItem(PORTAL_META);
}

/** Bearer for API — staff desk token wins, else portal, else hotel gate. */
export function activeBearer(): string | null {
  try {
    const staff = sessionStorage.getItem("hos.v2.desk.token");
    if (staff) return staff;
  } catch {
    /* ignore */
  }
  return readPortalToken() || readHotelToken();
}
