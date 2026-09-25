import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHotelCode,
  isValidHotelCodeFormat,
  normalizeHotelCodeInput,
  parseHotelCode,
} from "./hotel-codes";

describe("hotel-codes", () => {
  it("normalizes and validates", () => {
    assert.equal(normalizeHotelCodeInput(" thi-02 001 "), "THI02001");
    assert.equal(isValidHotelCodeFormat("THI02001"), true);
    assert.equal(isValidHotelCodeFormat("THI-02"), false);
  });

  it("builds and parses AAA LL NNN", () => {
    assert.equal(buildHotelCode("THI", "2", 1), "THI02001");
    assert.deepEqual(parseHotelCode("THI02001"), {
      dzongkhagCode: "THI",
      areaCode: "02",
      sequence: 1,
    });
  });
});
