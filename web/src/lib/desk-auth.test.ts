import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isHouseOpsStaff,
  isKotBoardRole,
  isPosFireRole,
  KOT_BOARD_ROLES,
  mapAccessLevelToDeskRole,
  MONEY_ROLES,
  POS_FIRE_ROLES,
  type DeskRole,
} from "./desk-auth";

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

  it("maps kitchen fnb laundry access levels", () => {
    assert.equal(mapAccessLevelToDeskRole("kitchen"), "kitchen");
    assert.equal(mapAccessLevelToDeskRole("fnb"), "fnb");
    assert.equal(mapAccessLevelToDeskRole("laundry"), "laundry");
  });

  it("defaults unknown levels to front_desk", () => {
    assert.equal(mapAccessLevelToDeskRole(null), "front_desk");
    assert.equal(mapAccessLevelToDeskRole("desk"), "front_desk");
  });
});

describe("requireMoneyDesk role set", () => {
  it("includes front_desk cashier gm owner and excludes ops-only roles", () => {
    assert.equal(MONEY_ROLES.has("front_desk"), true);
    assert.equal(MONEY_ROLES.has("cashier"), true);
    assert.equal(MONEY_ROLES.has("gm"), true);
    assert.equal(MONEY_ROLES.has("owner"), true);
    assert.equal(MONEY_ROLES.has("hk"), false);
    assert.equal(MONEY_ROLES.has("fnb"), false);
    assert.equal(MONEY_ROLES.has("kitchen"), false);
    assert.equal(MONEY_ROLES.has("laundry"), false);
  });

  it("PIN escape maps to gm which is a money role", () => {
    // hasDeskPinSession → getDeskRole returns "gm" when ALLOW_DESK_PIN_IN_PROD=1
    const pinRole: DeskRole = "gm";
    assert.equal(MONEY_ROLES.has(pinRole), true);
  });
});

describe("POS fire / kitchen display roles", () => {
  it("lets waiters send to the kitchen TV but not settle money", () => {
    assert.equal(isPosFireRole("fnb"), true);
    assert.equal(MONEY_ROLES.has("fnb"), false);
  });

  it("blocks housekeeping and laundry from send and from the kitchen TV", () => {
    for (const role of ["hk", "laundry"] as const) {
      assert.equal(isPosFireRole(role), false);
      assert.equal(isKotBoardRole(role), false);
      assert.equal(POS_FIRE_ROLES.has(role), false);
      assert.equal(KOT_BOARD_ROLES.has(role), false);
    }
  });

  it("lets cooks bump the board without firing POS tickets", () => {
    assert.equal(isKotBoardRole("kitchen"), true);
    assert.equal(isPosFireRole("kitchen"), false);
  });

  it("treats HK / laundry labels as house ops even without desk_role", () => {
    assert.equal(isHouseOpsStaff({ roleLabel: "Room maid" }), true);
    assert.equal(isHouseOpsStaff({ department: "Housekeeping" }), true);
    assert.equal(isHouseOpsStaff({ deskRole: "laundry" }), true);
    assert.equal(isHouseOpsStaff({ deskRole: "fnb", roleLabel: "Waiter" }), false);
  });
});
