import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
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
    expect(parsed?.orderId).toBe("order-uuid-1");
    expect(parsed?.propertyId).toBe("prop-uuid-1");
    expect(parsed?.exp).toBeGreaterThan(Date.now());
  });

  it("rejects tampered tokens", () => {
    const token = createPosReceiptShareToken(
      "order-uuid-1",
      "prop-uuid-1",
      Date.now(),
      secret,
    );
    expect(parsePosReceiptShareToken(`${token}x`, Date.now(), secret)).toBeNull();
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
    expect(
      parsePosReceiptShareToken(`${payload}.${sig}`, now, secret),
    ).toBeNull();
  });
});
