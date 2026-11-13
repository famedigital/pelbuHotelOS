import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirrors desk escapePrintHtml — keep escape semantics covered in CI. */
function escapePrintHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

describe("print html escape", () => {
  it("escapes markup that would blank or break a print frame", () => {
    assert.equal(escapePrintHtml(`SOULTRIPS <b>"x"</b> & co`), "SOULTRIPS &lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; co");
  });
});
