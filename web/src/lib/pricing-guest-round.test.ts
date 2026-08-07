import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guestRateAbsorbBtn,
  roundBtn,
  roundGuestWholeBtn,
} from "./pricing";

describe("roundGuestWholeBtn (Nu 0 or 5)", () => {
  it("keeps amounts already on 0 or 5", () => {
    assert.equal(roundGuestWholeBtn(2310), 2310);
    assert.equal(roundGuestWholeBtn(1325), 1325);
    assert.equal(roundGuestWholeBtn(240), 240);
  });

  it("floors to nearest lower 0 or 5 (guest never pays up)", () => {
    assert.equal(roundGuestWholeBtn(1328.25), 1325);
    assert.equal(roundGuestWholeBtn(1328.6), 1325);
    assert.equal(roundGuestWholeBtn(100.99), 100);
    assert.equal(roundGuestWholeBtn(138.6), 135);
    assert.equal(roundGuestWholeBtn(242.55), 240);
    assert.equal(roundGuestWholeBtn(7), 5);
    assert.equal(roundGuestWholeBtn(4.99), 0);
  });
});

describe("guestRateAbsorbBtn", () => {
  it("returns hotel credit down to Nu 0 or 5", () => {
    assert.equal(guestRateAbsorbBtn(1328.25), -3.25);
    assert.equal(guestRateAbsorbBtn(2310), 0);
    assert.equal(roundBtn(1328.25 + guestRateAbsorbBtn(1328.25)), 1325);
  });

  it("never increases guest payable", () => {
    for (const n of [0.01, 0.4, 3.6, 7, 10.07, 115.99, 242.55]) {
      assert.ok(guestRateAbsorbBtn(n) <= 0);
      assert.ok(roundBtn(n + guestRateAbsorbBtn(n)) <= roundBtn(n));
      const target = roundBtn(n + guestRateAbsorbBtn(n));
      assert.ok(target % 5 === 0 || target === 0);
    }
  });
});
