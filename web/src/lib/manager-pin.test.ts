import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isManagerDeskRole,
  resolveStaffDeskRole,
  verifyEnvManagerPin,
} from "./manager-pin-core";

describe("verifyEnvManagerPin", () => {
  it("matches POS_MANAGER_PIN when set", () => {
    const prev = process.env.POS_MANAGER_PIN;
    process.env.POS_MANAGER_PIN = "9876";
    try {
      assert.equal(verifyEnvManagerPin("9876"), true);
      assert.equal(verifyEnvManagerPin("0000"), false);
    } finally {
      if (prev === undefined) delete process.env.POS_MANAGER_PIN;
      else process.env.POS_MANAGER_PIN = prev;
    }
  });
});

describe("isManagerDeskRole", () => {
  it("accepts owner and gm only", () => {
    assert.equal(isManagerDeskRole("owner"), true);
    assert.equal(isManagerDeskRole("gm"), true);
    assert.equal(isManagerDeskRole("cashier"), false);
    assert.equal(isManagerDeskRole("front_desk"), false);
  });
});

describe("resolveStaffDeskRole", () => {
  it("prefers desk_role over access_level", () => {
    assert.equal(resolveStaffDeskRole("cashier", "owner"), "cashier");
    assert.equal(resolveStaffDeskRole(null, "owner"), "owner");
    assert.equal(resolveStaffDeskRole(null, "supervisor"), "gm");
  });
});
