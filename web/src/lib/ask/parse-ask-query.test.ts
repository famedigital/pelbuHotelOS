import { describe, expect, it } from "vitest";
import { parseAskQuery } from "./parse-ask-query";

describe("parseAskQuery", () => {
  const now = new Date("2026-10-18T10:00:00+06:00");

  it("parses rooms + day month + nights", () => {
    const p = parseAskQuery("3 rooms 22 oct 3n", now);
    expect(p).toEqual({
      rooms: 3,
      checkIn: "2026-10-22",
      checkOut: "2026-10-25",
      nights: 3,
      raw: "3 rooms 22 oct 3n",
    });
  });

  it("parses tonight", () => {
    const p = parseAskQuery("tonight 2 rooms", now);
    expect(p?.checkIn).toBe("2026-10-18");
    expect(p?.rooms).toBe(2);
    expect(p?.nights).toBe(1);
    expect(p?.checkOut).toBe("2026-10-19");
  });

  it("rolls past dates to next year", () => {
    const p = parseAskQuery("1 room 5 jan 2n", now);
    expect(p?.checkIn).toBe("2027-01-05");
    expect(p?.checkOut).toBe("2027-01-07");
  });

  it("returns null without a date", () => {
    expect(parseAskQuery("3 rooms", now)).toBeNull();
  });
});
