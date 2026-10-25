import assert from "node:assert/strict";
import test from "node:test";
import {
  bulkChoiceIsEmpty,
  hkBulkInsert,
  hkBulkPatch,
  parseBulkHkChoice,
} from "./bulk-update";

test("empty bulk choice is rejected by the helper", () => {
  const choice = parseBulkHkChoice({
    staffChoice: "keep",
    statusChoice: "keep",
    notes: "  ",
  });
  assert.equal(bulkChoiceIsEmpty(choice), true);
});

test("assigning staff on a new task starts it in progress", () => {
  const choice = parseBulkHkChoice({
    staffChoice: "staff-1",
    statusChoice: "keep",
    notes: "",
  });
  assert.deepEqual(hkBulkInsert(choice), {
    staff_id: "staff-1",
    status: "in_progress",
    notes: null,
    markComplete: false,
  });
});

test("done on a new task completes it and can still name an attendant", () => {
  const choice = parseBulkHkChoice({
    staffChoice: "staff-1",
    statusChoice: "done",
    notes: "Turndown",
  });
  assert.deepEqual(hkBulkInsert(choice), {
    staff_id: "staff-1",
    status: "done",
    notes: "Turndown",
    markComplete: true,
  });
});

test("staff on an open task moves it to in progress", () => {
  const choice = parseBulkHkChoice({
    staffChoice: "staff-1",
    statusChoice: "keep",
    notes: "",
  });
  assert.deepEqual(hkBulkPatch("open", choice), {
    staff_id: "staff-1",
    status: "in_progress",
    markComplete: false,
  });
});

test("clearing staff on an in-progress task reopens it", () => {
  const choice = parseBulkHkChoice({
    staffChoice: "clear",
    statusChoice: "keep",
    notes: "",
  });
  assert.deepEqual(hkBulkPatch("in_progress", choice), {
    staff_id: null,
    status: "open",
    markComplete: false,
  });
});

test("status and notes apply without touching staff", () => {
  const choice = parseBulkHkChoice({
    staffChoice: "keep",
    statusChoice: "skipped",
    notes: "Guest refused",
  });
  assert.deepEqual(hkBulkPatch("in_progress", choice), {
    status: "skipped",
    notes: "Guest refused",
    markComplete: false,
  });
});

test("invalid status is rejected", () => {
  assert.throws(
    () =>
      parseBulkHkChoice({
        staffChoice: "keep",
        statusChoice: "clean",
        notes: "",
      }),
    /Invalid status/,
  );
});
