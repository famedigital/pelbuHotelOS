import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertManagerPin, isManagerDeskRole, verifyEnvManagerPin } from "./index.js";

describe("manager pin", () => {
  it("recognises manager roles", () => {
    assert.equal(isManagerDeskRole("gm"), true);
    assert.equal(isManagerDeskRole("fo_agent"), false);
  });

  it("assertManagerPin rejects empty", async () => {
    const r = await assertManagerPin(undefined, () => true, "void");
    assert.equal(r.ok, false);
  });

  it("env pin matches", () => {
    assert.equal(
      verifyEnvManagerPin("1234", {
        POS_MANAGER_PIN: "1234",
        NODE_ENV: "test",
      }),
      true,
    );
  });
});
