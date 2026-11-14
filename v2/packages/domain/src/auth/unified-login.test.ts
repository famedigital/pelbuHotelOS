import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultPortalHomeRoute,
  resolveUnifiedLoginKind,
} from "./unified-login.js";

describe("resolveUnifiedLoginKind", () => {
  it("prefers hotel org membership over any portal", () => {
    assert.equal(
      resolveUnifiedLoginKind({
        isOrgMember: true,
        isAgent: true,
        isGuide: true,
        isDriver: true,
      }),
      "hotel",
    );
  });

  it("resolves agent when not hotel", () => {
    assert.equal(
      resolveUnifiedLoginKind({
        isOrgMember: false,
        isAgent: true,
        isGuide: false,
        isDriver: false,
      }),
      "agent",
    );
  });

  it("resolves guide before driver when both match", () => {
    assert.equal(
      resolveUnifiedLoginKind({
        isOrgMember: false,
        isAgent: false,
        isGuide: true,
        isDriver: true,
      }),
      "guide",
    );
  });

  it("resolves driver when only driver", () => {
    assert.equal(
      resolveUnifiedLoginKind({
        isOrgMember: false,
        isAgent: false,
        isGuide: false,
        isDriver: true,
      }),
      "driver",
    );
  });

  it("fails closed when nothing matches", () => {
    assert.equal(
      resolveUnifiedLoginKind({
        isOrgMember: false,
        isAgent: false,
        isGuide: false,
        isDriver: false,
      }),
      "none",
    );
  });
});

describe("defaultPortalHomeRoute", () => {
  it("maps roles to portal homes", () => {
    assert.equal(defaultPortalHomeRoute("agent"), "/partner");
    assert.equal(defaultPortalHomeRoute("guide"), "/guide");
    assert.equal(defaultPortalHomeRoute("driver"), "/driver");
  });
});
