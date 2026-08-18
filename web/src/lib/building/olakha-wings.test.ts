import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  frontCountForOlakhaFloor,
  splitOlakhaFloorWings,
} from "./olakha-wings";

describe("splitOlakhaFloorWings", () => {
  it("splits seven rooms into 4 front and 3 back", () => {
    const units = [201, 202, 203, 204, 205, 206, 207].map((n) => ({
      id: String(n),
      label: String(n),
      floor_label: "2",
    }));
    const { front, back } = splitOlakhaFloorWings(units, "2");
    assert.equal(frontCountForOlakhaFloor("2"), 4);
    assert.deepEqual(
      front.map((r) => r.label),
      ["201", "202", "203", "204"],
    );
    assert.deepEqual(
      back.map((r) => r.label),
      ["205", "206", "207"],
    );
  });

  it("splits six rooms on floor 5 into 3 and 3", () => {
    const units = [501, 502, 503, 504, 505, 506].map((n) => ({
      id: String(n),
      label: String(n),
      floor_label: "5",
    }));
    const { front, back } = splitOlakhaFloorWings(units, "5");
    assert.equal(front.length, 3);
    assert.equal(back.length, 3);
    assert.equal(front[0]?.label, "501");
    assert.equal(back[0]?.label, "504");
  });
});
