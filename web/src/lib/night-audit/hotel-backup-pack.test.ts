import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HOTEL_BACKUP_PACK_VERSION,
  HOTEL_BACKUP_SHEET_NAMES,
  hotelBackupStoragePath,
} from "@/lib/night-audit/hotel-backup-contract";

describe("hotel backup pack contract", () => {
  it("exposes pack_version 1 and required sheet names", () => {
    assert.equal(HOTEL_BACKUP_PACK_VERSION, 1);
    assert.ok(HOTEL_BACKUP_SHEET_NAMES.includes("_meta"));
    assert.ok(HOTEL_BACKUP_SHEET_NAMES.includes("Property"));
    assert.ok(HOTEL_BACKUP_SHEET_NAMES.includes("Rooms"));
    assert.ok(HOTEL_BACKUP_SHEET_NAMES.includes("Bookings"));
    assert.ok(HOTEL_BACKUP_SHEET_NAMES.includes("Audit"));
  });

  it("builds storage path propertyId/date.xlsx", () => {
    assert.equal(
      hotelBackupStoragePath("abc-uuid", "2026-08-01T00:00:00Z"),
      "abc-uuid/2026-08-01.xlsx",
    );
  });
});
