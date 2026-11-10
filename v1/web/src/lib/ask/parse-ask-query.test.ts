import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAskQuery } from "./parse-ask-query";

describe("parseAskQuery", () => {
  const now = new Date("2026-10-18T10:00:00+06:00");

  it("parses rooms + day month + nights", () => {
    const p = parseAskQuery("3 rooms 22 oct 3n", now);
    assert.deepEqual(p, {
      rooms: 3,
      checkIn: "2026-10-22",
      checkOut: "2026-10-25",
      nights: 3,
      raw: "3 rooms 22 oct 3n",
    });
  });

  it("parses tonight", () => {
    const p = parseAskQuery("tonight 2 rooms", now);
    assert.equal(p?.checkIn, "2026-10-18");
    assert.equal(p?.rooms, 2);
    assert.equal(p?.nights, 1);
    assert.equal(p?.checkOut, "2026-10-19");
  });

  it("rolls past dates to next year", () => {
    const p = parseAskQuery("1 room 5 jan 2n", now);
    assert.equal(p?.checkIn, "2027-01-05");
    assert.equal(p?.checkOut, "2027-01-07");
  });

  it("returns null without a date", () => {
    assert.equal(parseAskQuery("3 rooms", now), null);
  });
});
