import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStayMoneySteps,
  stayMoneyNextAction,
} from "./stay-money-cycle";

describe("stay-money-cycle", () => {
  it("marks charges not done when checked in with empty folio", () => {
    const steps = buildStayMoneySteps({
      status: "checked_in",
      hasFolio: true,
      hasCharges: false,
      balanceBtn: 0,
    });
    assert.equal(steps.find((s) => s.id === "checked_in")?.done, true);
    assert.equal(steps.find((s) => s.id === "charges")?.done, false);
    assert.equal(steps.find((s) => s.id === "charges")?.current, true);
    assert.equal(
      stayMoneyNextAction({
        status: "checked_in",
        hasFolio: true,
        hasCharges: false,
        balanceBtn: 0,
      }).label,
      "Post charges",
    );
  });

  it("moves to pay when charges exist and balance due", () => {
    const steps = buildStayMoneySteps({
      status: "checked_in",
      hasFolio: true,
      hasCharges: true,
      balanceBtn: 5000,
    });
    assert.equal(steps.find((s) => s.id === "charges")?.done, true);
    assert.equal(steps.find((s) => s.id === "paid")?.done, false);
    assert.equal(
      stayMoneyNextAction({
        status: "checked_in",
        hasFolio: true,
        hasCharges: true,
        balanceBtn: 5000,
      }).hrefHint,
      "folio",
    );
  });
});
