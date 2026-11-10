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

export function clearDeskSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(STAFF_KEY);
  sessionStorage.removeItem(PROPERTY_KEY);
}
