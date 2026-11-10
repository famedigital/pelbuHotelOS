import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAgentOpenItemFolio } from "./agent-open-item";

describe("isAgentOpenItemFolio", () => {
  it("is true when billed to an agent with no stay", () => {
    assert.equal(
      isAgentOpenItemFolio({ agent_id: "a1", booking_id: null }),
      true,
    );
  });

  it("is false for stay folios even with an agent", () => {
    assert.equal(
      isAgentOpenItemFolio({ agent_id: "a1", booking_id: "b1" }),
      false,
    );
  });

  it("is false without an agent", () => {
    assert.equal(
      isAgentOpenItemFolio({ agent_id: null, booking_id: null }),
      false,
    );
  });
});
