import assert from "node:assert/strict";
import { test } from "node:test";
import type { BookingRow } from "../../components/erp/BookingsTable";
import {
  buildReservationParties,
  partyRoomFit,
  softPartyKey,
  type BookingGroupMembership,
} from "./reservation-party";

function row(partial: Partial<BookingRow> & { id: string }): BookingRow {
  return {
    contact_name: "Guest",
    contact_phone: null,
    check_in: "2026-08-10",
    check_out: "2026-08-12",
    source: "agent",
    agent_id: null,
    agent_name: null,
    adults: 2,
    rooms: 1,
    status: "confirmed",
    assigned_count: 0,
    room_labels: null,
    room_fit: "none",
    ...partial,
  };
}

test("rolls formal group members into one party", () => {
  const rows = [
    row({ id: "b1", rooms: 1, assigned_count: 1, room_labels: "201" }),
    row({ id: "b2", rooms: 1, assigned_count: 0 }),
  ];
  const memberships: BookingGroupMembership[] = [
    {
      bookingId: "b1",
      groupId: "g1",
      groupName: "Windhorse",
      groupStatus: "open",
    },
    {
      bookingId: "b2",
      groupId: "g1",
      groupName: "Windhorse",
      groupStatus: "open",
    },
  ];
  const parties = buildReservationParties(rows, memberships);
  assert.equal(parties.length, 1);
  assert.equal(parties[0]!.kind, "group");
  assert.equal(parties[0]!.members.length, 2);
  assert.equal(parties[0]!.roomsSold, 2);
  assert.equal(partyRoomFit(parties[0]!), "partial");
});

test("suggests soft party for same agent and dates", () => {
  const agent = "agent-1";
  const rows = [
    row({
      id: "b1",
      agent_id: agent,
      agent_name: "Himalayan Tours",
      contact_name: "Room 1",
    }),
    row({
      id: "b2",
      agent_id: agent,
      agent_name: "Himalayan Tours",
      contact_name: "Room 2",
    }),
    row({ id: "b3", contact_name: "Walk-in unique" }),
  ];
  const parties = buildReservationParties(rows, []);
  assert.equal(parties.filter((p) => p.kind === "suggested").length, 1);
  assert.equal(parties.filter((p) => p.kind === "single").length, 1);
  const soft = parties.find((p) => p.kind === "suggested")!;
  assert.equal(soft.members.length, 2);
  assert.match(soft.label, /Himalayan/);
});

test("groups same party contact name without agent (Brazilian-style)", () => {
  const rows = [
    row({
      id: "b1",
      contact_name: "Brazilian march Group",
      room_labels: "404",
      assigned_count: 1,
    }),
    row({
      id: "b2",
      contact_name: "Brazilian  march Group",
      room_labels: "406",
      assigned_count: 1,
    }),
    row({
      id: "b3",
      contact_name: "Brazilian march Group",
      room_labels: "503",
      assigned_count: 1,
      check_out: "2026-08-13", // different checkout still groups by arrival
    }),
    row({
      id: "b4",
      contact_name: "Brazilian march Group",
      room_labels: "304",
      assigned_count: 1,
    }),
  ];
  for (const r of rows) {
    assert.ok(softPartyKey(r)?.startsWith("soft:contact:"));
  }
  const parties = buildReservationParties(rows, []);
  assert.equal(parties.length, 1);
  assert.equal(parties[0]!.kind, "suggested");
  assert.equal(parties[0]!.members.length, 4);
  assert.equal(parties[0]!.roomsSold, 4);
  assert.match(parties[0]!.label, /Brazilian/i);
});

test("groups multi-room by shared phone when names differ", () => {
  const rows = [
    row({
      id: "b1",
      contact_name: "Room A",
      contact_phone: "17112107",
      room_labels: "404",
    }),
    row({
      id: "b2",
      contact_name: "Room B",
      contact_phone: "+975-17-112-107",
      room_labels: "406",
    }),
  ];
  const parties = buildReservationParties(rows, []);
  assert.equal(parties[0]!.kind, "suggested");
  assert.equal(parties[0]!.members.length, 2);
});
