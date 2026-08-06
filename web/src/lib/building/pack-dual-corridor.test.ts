import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { floorStructure, snapToWing } from "./geometry";
import {
  floorCardBlurb,
  packDualCorridor,
  suggestFloors,
} from "./pack-dual-corridor";

describe("suggestFloors", () => {
  it("builds G + guest + attic", () => {
    const floors = suggestFloors({
      includeGround: true,
      guestFloorCount: 4,
      includeAttic: true,
      guestKeys: ["2", "3", "4", "5"],
    });
    assert.deepEqual(
      floors.map((f) => f.key),
      ["G", "2", "3", "4", "5", "A"],
    );
    assert.equal(floors[0].kind, "public");
    assert.equal(floors[1].kind, "guest");
    assert.equal(floors.at(-1)?.kind, "attic");
  });
});

describe("packDualCorridor", () => {
  it("places rooms on front and back wings per floor", () => {
    const floors = suggestFloors({
      includeGround: true,
      guestFloorCount: 2,
      includeAttic: false,
      guestKeys: ["2", "3"],
    });
    const rooms = [
      { id: "a", label: "201", floor_label: "2" },
      { id: "b", label: "202", floor_label: "2" },
      { id: "c", label: "203", floor_label: "2" },
      { id: "d", label: "301", floor_label: "3" },
      { id: "e", label: "302", floor_label: "3" },
    ];
    const { placements, summaries } = packDualCorridor({
      rooms,
      floors,
      corridor_axis: "ew",
    });
    assert.equal(placements.length, 5);
    const f2 = placements.filter((p) => p.floor_key === "2");
    assert.ok(f2.some((p) => p.wing === "front"));
    assert.ok(f2.some((p) => p.wing === "back"));
    assert.ok(
      f2.every(
        (p) => p.facade_side === "north" || p.facade_side === "south",
      ),
    );
    const s2 = summaries.find((s) => s.floor_key === "2");
    assert.ok(s2);
    assert.equal(s2.front.count + s2.back.count, 3);
    assert.match(floorCardBlurb(s2), /Front/);
    assert.match(floorCardBlurb(s2), /Back/);
  });

  it("reports unmatched without floor", () => {
    const floors = suggestFloors({
      includeGround: false,
      guestFloorCount: 1,
      includeAttic: false,
      guestKeys: ["2"],
    });
    const { unmatched } = packDualCorridor({
      rooms: [{ id: "x", label: "Suite-X", floor_label: null }],
      floors,
      corridor_axis: "ew",
    });
    assert.deepEqual(
      unmatched.map((r) => r.id),
      ["x"],
    );
  });
});

describe("snapToWing", () => {
  it("snaps Y toward nearest wing on ew axis", () => {
    const s = floorStructure("ew");
    const northish = snapToWing(40, 20, s);
    assert.equal(northish.wing, "front");
    assert.equal(northish.facade_side, "north");
    const southish = snapToWing(40, 80, s);
    assert.equal(southish.wing, "back");
    assert.equal(southish.facade_side, "south");
  });
});
