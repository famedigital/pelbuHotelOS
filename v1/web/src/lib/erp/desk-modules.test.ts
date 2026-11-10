import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultModulesForDeskRole,
  pathnameAllowedForModules,
} from "./desk-modules";

describe("kitchen display module grants", () => {
  it("gives F&B and kitchen the Kitchen TV tab; not HK or laundry", () => {
    assert.equal(defaultModulesForDeskRole("fnb").includes("/erp/kds"), true);
    assert.equal(
      defaultModulesForDeskRole("kitchen").includes("/erp/kds"),
      true,
    );
    assert.equal(defaultModulesForDeskRole("hk").includes("/erp/kds"), false);
    assert.equal(
      defaultModulesForDeskRole("laundry").includes("/erp/kds"),
      false,
    );
    assert.equal(
      defaultModulesForDeskRole("front_desk").includes("/erp/kds"),
      false,
    );
  });

  it("does not always-allow /erp/kds — grants must include the tab", () => {
    const hk = defaultModulesForDeskRole("hk");
    assert.equal(pathnameAllowedForModules("/erp/kds", hk), false);
    assert.equal(pathnameAllowedForModules("/erp/kds/pass", hk), false);

    const kitchen = defaultModulesForDeskRole("kitchen");
    assert.equal(pathnameAllowedForModules("/erp/kds", kitchen), true);
    assert.equal(pathnameAllowedForModules("/erp/kds/pass", kitchen), true);

    const fnb = defaultModulesForDeskRole("fnb");
    assert.equal(pathnameAllowedForModules("/erp/kds", fnb), true);
  });

  it("still allows print sheets without a KDS grant", () => {
    const hk = defaultModulesForDeskRole("hk");
    assert.equal(
      pathnameAllowedForModules("/erp/invoices/abc/print", hk),
      true,
    );
  });
});
