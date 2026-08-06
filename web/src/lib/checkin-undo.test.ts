import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertUndoCheckInLinesSafe,
  normalizeOptionalPhone,
} from "./checkin-undo";

test("normalizeOptionalPhone allows empty (phone later)", () => {
  assert.deepEqual(normalizeOptionalPhone(""), { ok: true, phone: "" });
  assert.deepEqual(normalizeOptionalPhone("  "), { ok: true, phone: "" });
  assert.deepEqual(normalizeOptionalPhone(null), { ok: true, phone: "" });
});

test("normalizeOptionalPhone accepts plausible numbers", () => {
  const r = normalizeOptionalPhone("+975 17123456");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.phone, "+975 17123456");
});

test("normalizeOptionalPhone rejects garbage", () => {
  const r = normalizeOptionalPhone("abc");
  assert.equal(r.ok, false);
});

test("undo CI allows day-1 room meal extra_bed only", () => {
  assert.equal(
    assertUndoCheckInLinesSafe([
      { source_type: "room", status: "posted" },
      { source_type: "meal_plan", status: "posted" },
    ]),
    null,
  );
});

test("undo CI blocks payments and laundry", () => {
  assert.match(
    assertUndoCheckInLinesSafe([], { hasPayments: true }) ?? "",
    /Payments/,
  );
  assert.match(
    assertUndoCheckInLinesSafe([{ source_type: "laundry", status: "posted" }]) ??
      "",
    /laundry/,
  );
  assert.match(
    assertUndoCheckInLinesSafe([
      { source_type: "room" },
      { source_type: "adjustment" },
    ]) ?? "",
    /adjustment/,
  );
});
