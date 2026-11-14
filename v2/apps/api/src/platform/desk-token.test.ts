import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  DEV_DESK_JWT_SECRET,
  assertDeskJwtSecretConfigured,
  issueDeskToken,
  verifyDeskToken,
} from "./desk-token.js";

const base = {
  sub: "user-1",
  propertyId: "11111111-1111-4111-8111-111111111111",
  role: "agent" as const,
  agencyOrgId: "22222222-2222-4222-8222-222222222222",
  subjectId: "33333333-3333-4333-8333-333333333333",
};

describe("desk token M01", () => {
  it("desk_token_accepts_valid_exp", () => {
    const token = issueDeskToken(base);
    const claims = verifyDeskToken(token);
    assert.ok(claims);
    assert.equal(claims.agencyOrgId, base.agencyOrgId);
    assert.equal(typeof claims.exp, "number");
    assert.ok((claims.exp as number) > Math.floor(Date.now() / 1000));
  });

  it("desk_token_rejects_missing_exp", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const body = Buffer.from(
      JSON.stringify({ ...base, iat: nowSec }),
    ).toString("base64url");
    const secret = process.env.DESK_JWT_SECRET ?? DEV_DESK_JWT_SECRET;
    const sig = createHash("sha256")
      .update(`${body}:${secret}`)
      .digest("base64url");
    assert.equal(verifyDeskToken(`${body}.${sig}`), null);
  });

  it("desk_token_rejects_expired", () => {
    const token = issueDeskToken({
      ...base,
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    assert.equal(verifyDeskToken(token), null);
  });

  it("assert_secret_throws_in_production_with_default", () => {
    const prevNode = process.env.NODE_ENV;
    const prevSecret = process.env.DESK_JWT_SECRET;
    const prevAllow = process.env.ALLOW_DEV_DESK_JWT_SECRET;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.DESK_JWT_SECRET;
      delete process.env.ALLOW_DEV_DESK_JWT_SECRET;
      assert.throws(() => assertDeskJwtSecretConfigured(), /DESK_JWT_SECRET/);
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevSecret === undefined) delete process.env.DESK_JWT_SECRET;
      else process.env.DESK_JWT_SECRET = prevSecret;
      if (prevAllow === undefined) delete process.env.ALLOW_DEV_DESK_JWT_SECRET;
      else process.env.ALLOW_DEV_DESK_JWT_SECRET = prevAllow;
    }
  });
});
