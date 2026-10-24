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
  });

  it("reads checkout and folio edits as desk jobs", () => {
    assert.equal(parseInnoraIntent("check out room 305")?.type, "checkout");
    assert.equal(parseInnoraIntent("open the folio for Karma")?.type, "open_folio");
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
    assert.equal(parseInnoraIntent("check in room 305")?.type, "open_stay");
    const cancel = parseInnoraIntent("cancel karma");
    assert.equal(cancel?.type, "open_stay");
    assert.equal(cancel && cancel.type === "open_stay" ? cancel.cancel : false, true);
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
