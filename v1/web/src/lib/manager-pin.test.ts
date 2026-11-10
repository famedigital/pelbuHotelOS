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

  it("matches alphanumeric DESK_PIN (desk login secret)", () => {
    const prevM = process.env.POS_MANAGER_PIN;
    const prevD = process.env.DESK_PIN;
    delete process.env.POS_MANAGER_PIN;
    process.env.DESK_PIN = "PelbuDesk1";
    try {
      assert.equal(verifyEnvManagerPin("PelbuDesk1"), true);
      assert.equal(verifyEnvManagerPin("wrong"), false);
    } finally {
      if (prevM === undefined) delete process.env.POS_MANAGER_PIN;
      else process.env.POS_MANAGER_PIN = prevM;
      if (prevD === undefined) delete process.env.DESK_PIN;
      else process.env.DESK_PIN = prevD;
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
