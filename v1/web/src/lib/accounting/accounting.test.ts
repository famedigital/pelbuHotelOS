import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertBalancedLines } from "./balance";
import { csvEscape, toCsv } from "./csv";

describe("accounting journal balance", () => {
  it("accepts balanced debit/credit lines", () => {
    assert.doesNotThrow(() =>
      assertBalancedLines([
        { accountId: "a", debitBtn: 100, creditBtn: 0 },
        { accountId: "b", debitBtn: 0, creditBtn: 100 },
      ]),
    );
  });

  it("rejects unbalanced journals", () => {
    assert.throws(() =>
      assertBalancedLines([
        { accountId: "a", debitBtn: 100, creditBtn: 0 },
        { accountId: "b", debitBtn: 0, creditBtn: 90 },
      ]),
    );
  });

  it("rejects lines that are both debit and credit", () => {
    assert.throws(() =>
      assertBalancedLines([
        { accountId: "a", debitBtn: 50, creditBtn: 50 },
        { accountId: "b", debitBtn: 0, creditBtn: 0 },
      ]),
    );
  });
});

describe("csv helpers", () => {
  it("escapes quotes and commas", () => {
    assert.equal(csvEscape('a, "b"'), `"a, ""b"""`);
  });

  it("builds csv with header", () => {
    const csv = toCsv(["a", "b"], [
      [1, "x"],
      [2, "y,z"],
    ]);
    assert.equal(csv, 'a,b\n1,x\n2,"y,z"\n');
  });
});
