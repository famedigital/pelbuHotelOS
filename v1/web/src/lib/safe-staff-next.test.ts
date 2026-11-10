import assert from "node:assert/strict";
import test from "node:test";
import {
  safePosRegisterNextPath,
  safeStaffNextPath,
} from "./safe-staff-next.ts";

test("POS login may only continue to the sell screen", () => {
  assert.equal(safePosRegisterNextPath("/erp/pos"), "/erp/pos");
  assert.equal(safePosRegisterNextPath("/erp/pos/"), "/erp/pos");
  assert.equal(safePosRegisterNextPath("/erp/pos?x=1"), null);
  assert.equal(safePosRegisterNextPath("/erp"), null);
  assert.equal(safePosRegisterNextPath("//erp/pos"), null);
  assert.equal(safePosRegisterNextPath("https://evil.example/erp/pos"), null);
});

test("staff next path still rejects the register", () => {
  assert.equal(safeStaffNextPath("/erp/pos"), null);
  assert.equal(safeStaffNextPath("/staff"), "/staff");
});
