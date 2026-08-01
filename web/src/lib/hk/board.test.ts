import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildHkCategories,
  buildHousekeepingBoardRows,
  rowMatchesFilter,
  type HkBoardRow,
} from "./board";

const arrival = new Set(["room-arrival"]);
const departure = new Set(["room-departure"]);

test("clean occupied room with no service gets no categories", () => {
  const categories = buildHkCategories(
    "room-101",
    "occupied",
    null,
    arrival,
    departure,
  );
  assert.deepEqual(categories, []);
});

test("check-in category only tags arrivals that still need prep", () => {
  assert.deepEqual(
    buildHkCategories("room-arrival", "dirty", null, arrival, departure),
    ["dirty", "check_in"],
  );
  assert.deepEqual(
    buildHkCategories("room-arrival", "clean", null, arrival, departure),
    [],
  );
  assert.deepEqual(
    buildHkCategories("room-arrival", "inspect", null, arrival, departure),
    ["dirty", "check_in"],
  );
});

test("checkout category tags departing rooms still occupied or dirty", () => {
  assert.deepEqual(
    buildHkCategories("room-departure", "occupied", null, arrival, departure),
    ["checkout"],
  );
  assert.deepEqual(
    buildHkCategories("room-departure", "clean", null, arrival, departure),
    [],
  );
});

test("service request always creates actionable work", () => {
  assert.deepEqual(
    buildHkCategories("room-101", "occupied", "2026-08-02T08:00:00Z", arrival, departure),
    ["service"],
  );
});

test("rowMatchesFilter keeps category filters exclusive", () => {
  const row: HkBoardRow = {
    id: "1",
    roomUnitId: "room-arrival",
    isPending: true,
    roomLabel: "101",
    staffName: null,
    staffId: null,
    status: "needs_assignment",
    notes: null,
    cleanOk: false,
    linenOk: false,
    amenitiesOk: false,
    categories: ["dirty", "check_in"],
  };

  assert.equal(rowMatchesFilter(row, "check_in"), true);
  assert.equal(rowMatchesFilter(row, "checkout"), false);
  assert.equal(rowMatchesFilter(row, "dirty"), true);
  assert.equal(rowMatchesFilter(row, "open"), true);
});

test("open and category filters hide done rows and uncategorized rows", () => {
  const doneRow: HkBoardRow = {
    id: "2",
    roomUnitId: "room-arrival",
    isPending: false,
    roomLabel: "102",
    staffName: "Maya",
    staffId: "staff-1",
    status: "done",
    notes: null,
    cleanOk: true,
    linenOk: true,
    amenitiesOk: true,
    categories: ["check_in"],
  };
  const emptyRow: HkBoardRow = { ...doneRow, id: "3", status: "open", categories: [] };

  assert.equal(rowMatchesFilter(doneRow, "check_in"), false);
  assert.equal(rowMatchesFilter(doneRow, "all"), true);
  assert.equal(rowMatchesFilter(emptyRow, "all"), false);
});

test("buildHousekeepingBoardRows skips clean rooms and done assignments", () => {
  const rows = buildHousekeepingBoardRows({
    units: [
      {
        id: "room-clean",
        label: "CLEAN-01",
        hk_status: "clean",
        service_requested_at: null,
      },
      {
        id: "room-dirty",
        label: "DIRTY-01",
        hk_status: "dirty",
        service_requested_at: null,
      },
      {
        id: "room-arrival",
        label: "ARR-01",
        hk_status: "inspect",
        service_requested_at: null,
      },
    ],
    assignments: [
      {
        id: "done-1",
        room_unit_id: "room-clean",
        status: "done",
        notes: null,
        staff_id: "staff-1",
        checklist_clean_ok: true,
        checklist_linen_ok: true,
        checklist_amenities_ok: true,
      },
    ],
    arrivalRoomIds: new Set(["room-arrival"]),
    departureRoomIds: new Set(),
  });

  assert.equal(rows.length, 2);
  assert.ok(rows.some((row) => row.roomLabel === "DIRTY-01"));
  assert.ok(rows.some((row) => row.roomLabel === "ARR-01"));
  assert.ok(!rows.some((row) => row.roomLabel === "CLEAN-01"));
});

test("check-in filter only returns arrival prep rows", () => {
  const rows = buildHousekeepingBoardRows({
    units: [
      {
        id: "room-arrival",
        label: "ARR-01",
        hk_status: "dirty",
        service_requested_at: null,
      },
      {
        id: "room-dirty",
        label: "DIRTY-01",
        hk_status: "dirty",
        service_requested_at: null,
      },
    ],
    assignments: [],
    arrivalRoomIds: new Set(["room-arrival"]),
    departureRoomIds: new Set(),
  });

  const checkInRows = rows.filter((row) => rowMatchesFilter(row, "check_in"));
  assert.equal(checkInRows.length, 1);
  assert.equal(checkInRows[0]?.roomLabel, "ARR-01");
});
