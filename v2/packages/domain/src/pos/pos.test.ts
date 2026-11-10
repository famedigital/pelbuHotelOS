import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCashTender,
  assertNoClientPrice,
  assertVoidPin,
  resolveServerLineNet,
  settleFiscalForTender,
  splitAmount,
} from "./index.js";

describe("pos server price", () => {
  it("rejects client unitPrice", () => {
    const r = assertNoClientPrice({ menuItemId: "x", unitPrice: 100 });
    assert.equal(r.ok, false);
  });

  it("resolves line from server menu only", () => {
    const r = resolveServerLineNet({ menuNetPrice: 380, qty: 2 });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.lineNet, 760);
  });
});

describe("pos fiscal", () => {
  it("room charge does not issue INV", () => {
    const r = settleFiscalForTender("room_charge");
    assert.equal(r.issueInv, false);
  });

  it("cash settle issues INV", () => {
    const r = settleFiscalForTender("cash");
    assert.equal(r.issueInv, true);
  });
});

describe("pos void and cash", () => {
  it("void requires pin", () => {
    assert.equal(assertVoidPin({ pinProvided: "0000", expectedPin: "1234" }).ok, false);
    assert.equal(assertVoidPin({ pinProvided: "1234", expectedPin: "1234" }).ok, true);
  });

  it("cash short fails", () => {
    const r = assertCashTender({ totalBtn: 1000, cashGivenBtn: 500 });
    assert.equal(r.ok, false);
  });

  it("split amount leaves remainder", () => {
    const r = splitAmount(1000, 400);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.primaryBtn, 600);
      assert.equal(r.splitBtn, 400);
    }
  });
});
