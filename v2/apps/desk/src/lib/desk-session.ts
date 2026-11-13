/** Desk PIN session — issued by `/v1/auth/pin`. */

import { notifyPropertyChanged } from "./api";

const TOKEN_KEY = "hos.v2.desk.token";
const STAFF_KEY = "hos.v2.desk.staff";
const PROPERTY_KEY = "hos.v2.desk.property";

export type DeskSessionStaff = {
  id: string;
  fullName: string;
  deskRole: string | null;
  employeeCode: string | null;
};

export type DeskSessionProperty = {
  id: string;
  slug: string;
  name: string;
};

export function writeDeskSession(
  token: string,
  staff: DeskSessionStaff,
  property: DeskSessionProperty,
): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(STAFF_KEY, JSON.stringify(staff));
  sessionStorage.setItem(PROPERTY_KEY, JSON.stringify(property));
  localStorage.setItem("hos.v2.propertyId", property.id);
  localStorage.setItem("hos.v2.propertySlug", property.slug);
  notifyPropertyChanged();
}

export function readDeskToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function readDeskStaff(): DeskSessionStaff | null {
  const raw = sessionStorage.getItem(STAFF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeskSessionStaff;
  } catch {
    return null;
  }
}

export function readDeskProperty(): DeskSessionProperty | null {
  const raw = sessionStorage.getItem(PROPERTY_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as DeskSessionProperty;
    } catch {
      /* fall through */
    }
  }
  const slug = localStorage.getItem("hos.v2.propertySlug")?.trim();
  const id = localStorage.getItem("hos.v2.propertyId")?.trim();
  if (slug && id) return { id, slug, name: slug };
  if (slug) return { id: slug, slug, name: slug };
  return null;
}

export function clearDeskSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(STAFF_KEY);
  sessionStorage.removeItem(PROPERTY_KEY);
}
