import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DEPT_PINS,
  defaultPinForDeskRole,
} from "./default-dept-pins.js";

describe("DEFAULT_DEPT_PINS", () => {
  it("locks the six department PINs", () => {
    const byPin = Object.fromEntries(
      DEFAULT_DEPT_PINS.map((d) => [d.pin, d.roleLabel]),
    );
    assert.equal(byPin["9999"], "Reservation");
    assert.equal(byPin["1111"], "FO");
    assert.equal(byPin["2222"], "FNB");
    assert.equal(byPin["3333"], "HK");
    assert.equal(byPin["4444"], "Kitchen");
    assert.equal(byPin["0000"], "OWNER");
    assert.equal(DEFAULT_DEPT_PINS.length, 6);
  });
});

describe("defaultPinForDeskRole", () => {
  it("maps roles to department PINs", () => {
    assert.equal(defaultPinForDeskRole("reservations"), "9999");
    assert.equal(defaultPinForDeskRole("fo"), "1111");
    assert.equal(defaultPinForDeskRole("fnb"), "2222");
    assert.equal(defaultPinForDeskRole("hk"), "3333");
    assert.equal(defaultPinForDeskRole("kitchen"), "4444");
    assert.equal(defaultPinForDeskRole("owner"), "0000");
    assert.equal(defaultPinForDeskRole("night_auditor"), null);
  });
});
