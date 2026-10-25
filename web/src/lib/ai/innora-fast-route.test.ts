import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { likeNeedle, matchStay, parseInnoraIntent } from "./innora-fast-route";

describe("parseInnoraIntent", () => {
  it("reads a bill lookup without a model", () => {
    assert.deepEqual(parseInnoraIntent("can u find all bills of soul trips"), {
      type: "find_bills",
      query: "soul trips",
    });
    assert.deepEqual(parseInnoraIntent("find the soul trips bill"), {
      type: "find_bills",
      query: "soul trips",
    });
    assert.deepEqual(parseInnoraIntent("open yak holiday master bill"), {
      type: "open_master",
      query: "yak holiday",
    });
  });

  it("reads checkout and folio edits as desk jobs", () => {
    assert.equal(parseInnoraIntent("check out room 305")?.type, "checkout");
    assert.equal(parseInnoraIntent("open the folio for Karma")?.type, "open_folio");
    assert.equal(parseInnoraIntent("checkout all the reservation till date")?.type, "close_through_today");
    assert.equal(
      parseInnoraIntent("update today's inhouse and arrival")?.type,
      "close_through_today",
    );
    assert.equal(parseInnoraIntent("go to arrivals")?.type, "open_page");
  });

  it("opens an existing page or stay card without a model", () => {
    assert.deepEqual(parseInnoraIntent("kitchen"), {
      type: "open_page",
      href: "/erp/kitchen",
      label: "Kitchen",
    });
    assert.deepEqual(parseInnoraIntent("save rates"), {
      type: "open_page",
      href: "/erp/rates",
      label: "Rates",
    });
    assert.deepEqual(parseInnoraIntent("create a booking"), {
      type: "open_page",
      href: "/erp/reserve",
      label: "Reserve",
    });
    assert.deepEqual(parseInnoraIntent("change the rate for room 305"), {
      type: "open_stay",
      query: "305",
      step: "stay_money",
      cancel: false,
    });
    assert.equal(parseInnoraIntent("check in room 305")?.type, "check_in_guest");
    assert.deepEqual(parseInnoraIntent("add 2 extra mattresses for room 207"), {
      type: "post_bill_addon",
      addon: "mattress",
      qty: 2,
      item: "",
      speed: "same_day",
      query: "room 207",
    });
    assert.deepEqual(parseInnoraIntent("add laundry 2 shirts for room 207 express"), {
      type: "post_bill_addon",
      addon: "laundry",
      qty: 2,
      item: "shirts",
      speed: "express",
      query: "room 207",
    });
    assert.deepEqual(parseInnoraIntent("add minibar water for karma"), {
      type: "post_bill_addon",
      addon: "service",
      qty: 1,
      item: "water",
      speed: "same_day",
      query: "karma",
    });
    const cancel = parseInnoraIntent("cancel karma");
    assert.equal(cancel?.type, "cancel_stay");
    assert.deepEqual(parseInnoraIntent("book tashi from 2026-11-01 to 2026-11-03 room 305"), {
      type: "reserve_stay",
      name: "tashi",
      checkIn: "2026-11-01",
      checkOut: "2026-11-03",
      room: "305",
    });
    assert.equal(parseInnoraIntent("run night audit")?.type, "night_audit");
    assert.equal(parseInnoraIntent("issue invoice for room 207")?.type, "issue_invoice");
    const paid = parseInnoraIntent("collect 5000 cash from room 305");
    assert.equal(paid?.type, "take_payment");
    assert.equal(paid && paid.type === "take_payment" ? paid.amount : 0, 5000);
    assert.equal(parseInnoraIntent("move karma to room 306")?.type, "move_room");
  });
});

describe("matchStay", () => {
  const stays = [
    { name: "Karma Dorji", rooms: "305" },
    { name: "Karma Dorji", rooms: "102" },
  ];

  it("prefers the room over a shared name", () => {
    assert.deepEqual(matchStay(stays, "room 305"), [stays[0]]);
  });
});

describe("likeNeedle", () => {
  it("keeps word order and drops wildcard characters", () => {
    assert.equal(likeNeedle("Soul Trips"), "%soul%trips%");
  });
});
