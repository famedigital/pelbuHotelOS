import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guidePhoneFromPlaceholder,
  isPlaceholderGuideNumber,
} from "./guide-number";

describe("isPlaceholderGuideNumber", () => {
  it("treats blank, name slugs, and mobiles as missing", () => {
    assert.equal(isPlaceholderGuideNumber(null), true);
    assert.equal(isPlaceholderGuideNumber("  "), true);
    assert.equal(isPlaceholderGuideNumber("name:karma"), true);
    assert.equal(isPlaceholderGuideNumber("17123456"), true);
    assert.equal(isPlaceholderGuideNumber("+975 1712 3456"), true);
  });

  it("keeps a real guide number", () => {
    assert.equal(isPlaceholderGuideNumber("G-2041"), false);
    assert.equal(guidePhoneFromPlaceholder("17123456"), "17123456");
    assert.equal(guidePhoneFromPlaceholder("G-2041"), null);
  });
});
