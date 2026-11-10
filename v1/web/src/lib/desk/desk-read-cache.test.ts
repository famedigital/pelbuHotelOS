import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyFreshness,
  deskCacheKey,
  hashDeskPayload,
  isDeskReadCacheEnabled,
  isHardExpired,
  type DeskReadCacheRecord,
} from "./desk-read-cache";

function record(
  partial: Partial<DeskReadCacheRecord> & Pick<DeskReadCacheRecord, "updatedAt" | "expiresAt">,
): DeskReadCacheRecord {
  return {
    key: "test",
    propertyId: "prop-1",
    schemaVersion: 1,
    payloadHash: "abc",
    payload: { ok: true },
    ...partial,
  };
}

describe("desk-read-cache", () => {
  it("hashes stably regardless of key order", () => {
    assert.equal(
      hashDeskPayload({ a: 1, b: 2 }),
      hashDeskPayload({ b: 2, a: 1 }),
    );
  });

  it("builds property-scoped keys", () => {
    assert.equal(
      deskCacheKey("pos:bootstrap", "p1"),
      "pos:bootstrap:p:p1",
    );
    assert.equal(
      deskCacheKey("reservations:list", "p1", "b:all"),
      "reservations:list:p:p1:b:all",
    );
  });

  it("classifies soft vs hard TTL", () => {
    const now = Date.parse("2026-08-26T12:00:00.000Z");
    const updatedAt = new Date(now - 60_000).toISOString();
    const expiresAt = new Date(now + 60_000).toISOString();
    const row = record({ updatedAt, expiresAt });
    assert.equal(classifyFreshness(row, 30_000, now), "stale");
    assert.equal(classifyFreshness(row, 120_000, now), "fresh");
    assert.equal(
      classifyFreshness(row, 30_000, now + 120_000),
      "expired",
    );
    assert.equal(isHardExpired(row, now + 120_000), true);
  });

  it("kill-switch env is readable", () => {
    assert.equal(typeof isDeskReadCacheEnabled(), "boolean");
  });
});
