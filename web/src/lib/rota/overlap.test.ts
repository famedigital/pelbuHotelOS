import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertNoOverlap,
  busyStaffIds,
  findOverlappingShift,
  freeStaffFilter,
  isoWeekday,
  normalizeTime,
  templateAppliesOnDay,
  timesOverlap,
  type ShiftInterval,
} from "./overlap";

test("normalizeTime pads HH:MM", () => {
  assert.equal(normalizeTime("09:00"), "09:00:00");
  assert.equal(normalizeTime("09:00:00"), "09:00:00");
});

test("timesOverlap catches partial and full overlaps", () => {
  assert.equal(
    timesOverlap({ startsAt: "09:00", endsAt: "17:00" }, { startsAt: "16:00", endsAt: "20:00" }),
    true,
  );
  assert.equal(
    timesOverlap({ startsAt: "09:00", endsAt: "12:00" }, { startsAt: "12:00", endsAt: "17:00" }),
    false,
  );
  assert.equal(
    timesOverlap({ startsAt: "10:00", endsAt: "11:00" }, { startsAt: "09:00", endsAt: "17:00" }),
    true,
  );
  assert.equal(
    timesOverlap({ startsAt: "08:00", endsAt: "09:00" }, { startsAt: "09:00", endsAt: "17:00" }),
    false,
  );
});

const peers: ShiftInterval[] = [
  {
    id: "a",
    staffId: "s1",
    shiftDate: "2026-08-03",
    startsAt: "09:00:00",
    endsAt: "17:00:00",
    status: "draft",
  },
  {
    id: "b",
    staffId: "s2",
    shiftDate: "2026-08-03",
    startsAt: "12:00:00",
    endsAt: "20:00:00",
    status: "published",
  },
];

test("findOverlappingShift scopes by staff and date", () => {
  const hit = findOverlappingShift(
    {
      staffId: "s1",
      shiftDate: "2026-08-03",
      startsAt: "16:00",
      endsAt: "18:00",
    },
    peers,
  );
  assert.equal(hit?.id, "a");
  assert.equal(
    findOverlappingShift(
      {
        staffId: "s1",
        shiftDate: "2026-08-04",
        startsAt: "16:00",
        endsAt: "18:00",
      },
      peers,
    ),
    null,
  );
});

test("assertNoOverlap ignores self when editing", () => {
  assert.doesNotThrow(() =>
    assertNoOverlap(
      {
        id: "a",
        staffId: "s1",
        shiftDate: "2026-08-03",
        startsAt: "09:00",
        endsAt: "17:00",
      },
      peers,
      { ignoreId: "a" },
    ),
  );
  assert.throws(
    () =>
      assertNoOverlap(
        {
          staffId: "s1",
          shiftDate: "2026-08-03",
          startsAt: "10:00",
          endsAt: "11:00",
        },
        peers,
      ),
    /overlaps/,
  );
});

test("busyStaffIds and freeStaffFilter mark exclusivity", () => {
  const busy = busyStaffIds(
    { shiftDate: "2026-08-03", startsAt: "13:00", endsAt: "15:00" },
    peers,
  );
  assert.deepEqual([...busy].sort(), ["s1", "s2"]);

  const free = freeStaffFilter(
    [
      { id: "s1", name: "A" },
      { id: "s2", name: "B" },
      { id: "s3", name: "C" },
    ],
    { shiftDate: "2026-08-03", startsAt: "13:00", endsAt: "15:00" },
    peers,
  );
  assert.equal(free.find((m) => m.id === "s3")?.busy, false);
  assert.equal(free.find((m) => m.id === "s1")?.busy, true);
});

test("isoWeekday and template day filters", () => {
  // 2026-08-03 is Monday
  assert.equal(isoWeekday("2026-08-03"), 1);
  assert.equal(isoWeekday("2026-08-09"), 7);
  assert.equal(templateAppliesOnDay([], "2026-08-03"), true);
  assert.equal(templateAppliesOnDay([1, 2, 3], "2026-08-03"), true);
  assert.equal(templateAppliesOnDay([6, 7], "2026-08-03"), false);
});
