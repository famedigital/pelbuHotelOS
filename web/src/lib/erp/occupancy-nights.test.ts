import assert from "node:assert/strict";
import test from "node:test";
import { occupancyByNight, type OccupancyUnit } from "./occupancy-nights";

const units: OccupancyUnit[] = [
  { id: "a", label: "302", typeName: "Twin", kind: "guest", outOfOrder: false },
  { id: "b", label: "405", typeName: "King", kind: "guest", outOfOrder: false },
  { id: "c", label: "201", typeName: "Guide", kind: "guide", outOfOrder: false },
  { id: "d", label: "101", typeName: "Twin", kind: "guest", outOfOrder: true },
];

test("a departure frees the room on checkout morning", () => {
  const nights = occupancyByNight(
    units,
    [{ unitId: "a", from: "2026-10-24", to: "2026-10-26" }],
    "2026-10-25",
    "2026-10-26",
  );
  assert.equal(nights[0]?.date, "2026-10-25");
  assert.equal(nights[0]?.occupied, 1);
  assert.equal(nights[0]?.empty, 1);
  assert.equal(nights[1]?.occupied, 0);
  assert.equal(nights[1]?.empty, 2);
  assert.equal(nights[0]?.outOfOrder, 1);
});

test("guide beds are not sellable empty rooms", () => {
  const nights = occupancyByNight(units, [], "2026-10-25", "2026-10-25");
  assert.equal(nights[0]?.empty, 2);
  const guide = nights[0]?.types.find((type) => type.name === "Guide");
  assert.deepEqual(guide?.empty, ["201"]);
});
