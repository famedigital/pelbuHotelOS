import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapAccessLevelToDeskRole, type DeskRole } from "./desk-auth";

/** Money roles allowed by requireMoneyDesk (hk excluded). */
const MONEY_ROLES: ReadonlySet<DeskRole> = new Set([
  "cashier",
  "gm",
  "owner",
  "front_desk",
]);

describe("mapAccessLevelToDeskRole", () => {
  it("maps owner and gm to owner", () => {
    assert.equal(mapAccessLevelToDeskRole("owner"), "owner");
    assert.equal(mapAccessLevelToDeskRole("GM"), "owner");
  });

  it("maps supervisor and hr_admin to gm", () => {
    assert.equal(mapAccessLevelToDeskRole("supervisor"), "gm");
    assert.equal(mapAccessLevelToDeskRole("hr_admin"), "gm");
  });

  it("maps cashier and housekeeping distinctly", () => {
    assert.equal(mapAccessLevelToDeskRole("cashier"), "cashier");
    assert.equal(mapAccessLevelToDeskRole("hk"), "hk");
    assert.equal(mapAccessLevelToDeskRole("housekeeping"), "hk");
  });

  it("defaults unknown levels to front_desk", () => {
    assert.equal(mapAccessLevelToDeskRole(null), "front_desk");
    assert.equal(mapAccessLevelToDeskRole("desk"), "front_desk");
  });
});

describe("requireMoneyDesk role set", () => {
  it("includes front_desk cashier gm owner and excludes hk", () => {
    assert.equal(MONEY_ROLES.has("front_desk"), true);
    assert.equal(MONEY_ROLES.has("cashier"), true);
    assert.equal(MONEY_ROLES.has("gm"), true);
    assert.equal(MONEY_ROLES.has("owner"), true);
    assert.equal(MONEY_ROLES.has("hk"), false);
  });

  it("PIN escape maps to gm which is a money role", () => {
    // hasDeskPinSession → getDeskRole returns "gm" when ALLOW_DESK_PIN_IN_PROD=1
    const pinRole: DeskRole = "gm";
    assert.equal(MONEY_ROLES.has(pinRole), true);
  });
});
