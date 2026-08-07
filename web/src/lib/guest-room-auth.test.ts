import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { digitsOnly, phonesMatch } from "@/lib/guest-room-phone";

describe("guest room phone privacy match", () => {
  it("strips non-digits", () => {
    assert.equal(digitsOnly("+975 17 123 456"), "97517123456");
  });

  it("matches with country code on one side", () => {
    assert.equal(phonesMatch("+97517123456", "17123456"), true);
    assert.equal(phonesMatch("17123456", "+975 17 123 456"), true);
  });

  it("rejects short or mismatched phones", () => {
    assert.equal(phonesMatch("123", "1234567"), false);
    assert.equal(phonesMatch("17111111", "17222222"), false);
  });
});
