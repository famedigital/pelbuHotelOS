import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPosReceiptShareToken,
  parsePosReceiptShareToken,
} from "./pos-receipt-share-token";

describe("pos receipt share token", () => {
  const secret = "test-receipt-share-secret";

  it("round-trips order + property", () => {
    const token = createPosReceiptShareToken(
      "order-uuid-1",
      "prop-uuid-1",
      Date.now(),
      secret,
    );
    const parsed = parsePosReceiptShareToken(token, Date.now(), secret);
    assert.equal(parsed?.orderId, "order-uuid-1");
    assert.equal(parsed?.propertyId, "prop-uuid-1");
    assert.ok((parsed?.exp ?? 0) > Date.now());
  });

  it("rejects tampered tokens", () => {
    const token = createPosReceiptShareToken(
      "order-uuid-1",
      "prop-uuid-1",
      Date.now(),
      secret,
    );
    assert.equal(parsePosReceiptShareToken(`${token}x`, Date.now(), secret), null);
  });

  it("rejects expired tokens", () => {
    const now = Date.now();
    const body = {
      orderId: "order-uuid-1",
      propertyId: "prop-uuid-1",
      exp: now - 1,
    };
    const payload = Buffer.from(JSON.stringify(body))
      .toString("base64url")
      .replace(/=+$/, "");
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    assert.equal(
      parsePosReceiptShareToken(`${payload}.${sig}`, now, secret),
      null,
    );
  });
});
