/** Pack contract — safe to import from unit tests (no server-only). */

export const HOTEL_BACKUP_PACK_VERSION = 1;
export const HOTEL_BACKUP_BUCKET = "night-audit-packs";

export const HOTEL_BACKUP_SHEET_NAMES = [
  "_meta",
  "Audit",
  "InHouse",
  "Arrivals7d",
  "DeparturesDue",
  "Bookings",
  "FolioLines",
  "Payments",
  "LaundryOpen",
  "Property",
  "RoomTypes",
  "Rooms",
  "Seasons",
  "Rates",
  "DepositRules",
  "Outlets",
  "MenuItems",
  "LaundryCatalog",
  "Agents",
  "Staff",
  "DiningTables",
] as const;

export function hotelBackupStoragePath(
  propertyId: string,
  businessDate: string,
): string {
  return `${propertyId}/${businessDate.slice(0, 10)}.xlsx`;
}
