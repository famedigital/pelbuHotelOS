import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickRoomRateAmount } from "./rates";

describe("pickRoomRateAmount parity (batch vs single)", () => {
  it("uses double amount by default", () => {
    assert.equal(
      pickRoomRateAmount(
        { amount_btn: 5000, amount_single_btn: 4000 },
        {},
      ),
      5000,
    );
  });

  it("uses single when adults === 1", () => {
    assert.equal(
      pickRoomRateAmount(
        { amount_btn: 5000, amount_single_btn: 4000 },
        { adults: 1 },
      ),
      4000,
    );
  });

  it("falls back to double when single missing", () => {
    assert.equal(
      pickRoomRateAmount(
        { amount_btn: 5000, amount_single_btn: null },
        { adults: 1 },
      ),
      5000,
    );
  });

  it("honors occupancy double even for one adult", () => {
    assert.equal(
      pickRoomRateAmount(
        { amount_btn: 5000, amount_single_btn: 4000 },
        { occupancy: "double", adults: 1 },
      ),
      5000,
    );
  });

  it("returns null when both amounts missing", () => {
    assert.equal(
      pickRoomRateAmount({ amount_btn: null, amount_single_btn: null }, {}),
      null,
    );
  });
});
