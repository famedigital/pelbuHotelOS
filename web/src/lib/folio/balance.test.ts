import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { netFolioBalance } from "./balance";

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
});
