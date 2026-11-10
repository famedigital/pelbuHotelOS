import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createAgentRateViewToken,
  parseAgentRateViewToken,
} from "./agent-rate-view-token";

const SECRET = "test-secret-not-for-prod";

describe("agent rate view token", () => {
  it("round-trips property + email until expiry", () => {
    const now = Date.now();
    const token = createAgentRateViewToken(
      "prop-1",
      "Agent@Example.com",
      now,
      SECRET,
    );
    const session = parseAgentRateViewToken(token, now + 1000, SECRET);
    assert.ok(session);
    assert.equal(session!.propertyId, "prop-1");
    assert.equal(session!.email, "agent@example.com");
  });

  it("rejects tampered signature", () => {
    const token = createAgentRateViewToken("prop-1", "a@b.com", Date.now(), SECRET);
    const session = parseAgentRateViewToken(token + "x", Date.now(), SECRET);
    assert.equal(session, null);
  });

  it("rejects expired token", () => {
    const now = Date.now();
    const token = createAgentRateViewToken("prop-1", "a@b.com", now, SECRET);
    const session = parseAgentRateViewToken(
      token,
      now + 5 * 60 * 60 * 1000,
      SECRET,
    );
    assert.equal(session, null);
  });
});
