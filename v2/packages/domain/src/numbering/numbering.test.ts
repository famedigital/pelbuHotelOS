import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatInv, formatPsbn, formatConfirmationNo } from "./index.js";

describe("numbering", () => {
  it("formats PSBN and INV", () => {
    assert.equal(formatPsbn(1, 2026), "PSBN-2026-00001");
    assert.equal(formatInv(12, 2026), "INV-2026-0012");
  });

  it("formats confirmation", () => {
    assert.equal(formatConfirmationNo("PS", 160, 2026), "PS-2026-00160");
  });
});
