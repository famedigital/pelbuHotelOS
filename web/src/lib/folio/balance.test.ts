import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { netFolioBalance } from "./balance";
import { guestLedgerBalance } from "./guest-ledger";

describe("netFolioBalance", () => {
  it("sums posted lines", () => {
    const balance = netFolioBalance([
      { id: "a", status: "posted", total_btn: 100 },
      { id: "b", status: "posted", total_btn: -50 },
    ]);
    assert.equal(balance, 50);
  });

  it("excludes voided originals and their reversal credits", () => {
    const balance = netFolioBalance([
      { id: "charge", status: "voided", total_btn: 100 },
      {
        id: "rev",
        status: "posted",
        total_btn: -100,
        reverses_line_id: "charge",
      },
    ]);
    assert.equal(balance, 0);
  });

  it("Erik fixture: voided room + reversal must not inflate due", () => {
    // Wrong StayHub path summed posted-only including reversal → Nu 2490-ish ghost.
    // Guest-visible due should be remaining good charges only.
    const lines = [
      {
        id: "room-wrong",
        status: "voided",
        total_btn: 5682,
        reverses_line_id: null,
      },
      {
        id: "rev-wrong",
        status: "posted",
        total_btn: -5682,
        reverses_line_id: "room-wrong",
      },
      {
        id: "room-ok-1",
        status: "posted",
        total_btn: 5165,
        reverses_line_id: null,
      },
      {
        id: "room-ok-2",
        status: "posted",
        total_btn: 5165,
        reverses_line_id: null,
      },
      {
        id: "fnb",
        status: "posted",
        total_btn: -2010,
        reverses_line_id: null,
      },
    ];
    const due = guestLedgerBalance(lines);
    // 5165 + 5165 - 2010 = 8320 (payment-like negative as posted credit)
    assert.equal(due, 8320);
    // Naïve posted sum would be 8320 - 5682 = 2638 (or similar ghost)
    const naive = lines
      .filter((l) => l.status === "posted")
      .reduce((s, l) => s + l.total_btn, 0);
    assert.notEqual(due, naive);
  });
});
