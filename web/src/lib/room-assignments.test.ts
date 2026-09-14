import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAssignableInventoryKind,
  stayRangesOverlap,
  unitReadyForCheckIn,
} from "./room-assignments";

test("stay ranges overlap as half-open intervals", () => {
  assert.equal(stayRangesOverlap("2026-07-01", "2026-07-03", "2026-07-03", "2026-07-05"), false);
  assert.equal(stayRangesOverlap("2026-07-01", "2026-07-04", "2026-07-03", "2026-07-05"), true);
  assert.equal(stayRangesOverlap("2026-07-01", "2026-07-02", "2026-07-02", "2026-07-03"), false);
});

test("guest rooms require clean readiness; comps do not", () => {
  assert.equal(unitReadyForCheckIn("sellable_guest", "dirty", true), false);
  assert.equal(unitReadyForCheckIn("sellable_guest", "clean", true), true);
  assert.equal(unitReadyForCheckIn("guide_comp", "dirty", true), true);
  assert.equal(unitReadyForCheckIn("driver_comp", "ooo", true), true);
  assert.equal(unitReadyForCheckIn("sellable_guest", "dirty", false), true);
});

test("assignable kinds include guest and comp beds only", () => {
  assert.equal(isAssignableInventoryKind("sellable_guest"), true);
  assert.equal(isAssignableInventoryKind("guide_comp"), true);
  assert.equal(isAssignableInventoryKind("driver_comp"), true);
  assert.equal(isAssignableInventoryKind("staff"), false);
});
