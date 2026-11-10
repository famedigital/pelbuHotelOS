import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rateLimit } from "./rate-limit";

describe("rateLimit memory fallback", () => {
  it("allows under the limit then blocks", async () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    const a = await rateLimit(key, { limit: 2, windowMs: 60_000 });
    const b = await rateLimit(key, { limit: 2, windowMs: 60_000 });
    const c = await rateLimit(key, { limit: 2, windowMs: 60_000 });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(c.ok, false);
  });
});
