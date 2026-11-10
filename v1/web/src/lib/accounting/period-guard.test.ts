import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { periodGuardFromForm } from "@/lib/accounting/period-guard-form";

describe("periodGuardFromForm", () => {
  it("returns undefined when override fields are empty", () => {
    const fd = new FormData();
    assert.equal(periodGuardFromForm(fd, "prop-1"), undefined);
  });

  it("parses manager pin and reason", () => {
    const fd = new FormData();
    fd.set("manager_pin", "1234");
    fd.set("period_override_reason", "Late night audit correction");
    const guard = periodGuardFromForm(fd, "prop-1");
    assert.equal(guard?.propertyId, "prop-1");
    assert.equal(guard?.managerPin, "1234");
    assert.equal(guard?.overrideReason, "Late night audit correction");
  });
});
