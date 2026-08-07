import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guestRateAbsorbBtn,
  roundBtn,
  roundGuestWholeBtn,
} from "./pricing";

describe("roundGuestWholeBtn", () => {
  it("keeps whole Nu amounts", () => {
    assert.equal(roundGuestWholeBtn(2310), 2310);
    assert.equal(roundGuestWholeBtn(1328), 1328);
  });

  it("floors when nearest would charge guest more", () => {
    assert.equal(roundGuestWholeBtn(1328.25), 1328);
    assert.equal(roundGuestWholeBtn(1328.6), 1328);
    assert.equal(roundGuestWholeBtn(100.99), 100);
  });

  it("rounds down half away from guest overpay (1.5 -> 1)", () => {
    assert.equal(roundGuestWholeBtn(1.5), 1);
  });

  it("rounds down to nearest when that is still not above", () => {
    assert.equal(roundGuestWholeBtn(1328.4), 1328);
  });
});

describe("guestRateAbsorbBtn", () => {
  it("returns hotel credit for fractional GST/SC totals", () => {
    assert.equal(guestRateAbsorbBtn(1328.25), -0.25);
    assert.equal(guestRateAbsorbBtn(693), 0);
    assert.equal(roundBtn(1328.25 + guestRateAbsorbBtn(1328.25)), 1328);
  });

  it("never increases guest payable", () => {
    for (const n of [0.01, 0.4, 0.5, 0.6, 10.07, 115.99]) {
      assert.ok(guestRateAbsorbBtn(n) <= 0);
      assert.ok(roundBtn(n + guestRateAbsorbBtn(n)) <= roundBtn(n));
    }
  });
});
