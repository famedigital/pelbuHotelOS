import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nightsBetween } from "@/lib/rates";

/** Mirror overlap helper used by manager flash (unit-tested without DB). */
function overlapNights(
  stayIn: string,
  stayOut: string,
  rangeFrom: string,
  rangeToExclusive: string,
): number {
  const start = stayIn > rangeFrom ? stayIn : rangeFrom;
  const end = stayOut < rangeToExclusive ? stayOut : rangeToExclusive;
  if (end <= start) return 0;
  return nightsBetween(start, end);
}

describe("manager flash overlap nights", () => {
  it("clips stay to reporting window", () => {
    assert.equal(
      overlapNights("2026-07-28", "2026-08-05", "2026-08-01", "2026-08-04"),
      3,
    );
    assert.equal(
      overlapNights("2026-08-02", "2026-08-03", "2026-08-01", "2026-08-04"),
      1,
    );
    assert.equal(
      overlapNights("2026-07-01", "2026-07-10", "2026-08-01", "2026-08-04"),
      0,
    );
  });
});
