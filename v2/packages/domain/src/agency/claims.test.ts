import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agencyOrgIdFromActor,
  assertAgencyOrgMatchesClaim,
} from "./claims.js";

describe("agency claims", () => {
  it("agency_org_id_from_actor_requires_claim", () => {
    assert.throws(() => agencyOrgIdFromActor({}), /NO_AGENCY_ORG/);
    assert.equal(
      agencyOrgIdFromActor({ agencyOrgId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });

  it("rejects_body_org_override", () => {
    assert.throws(
      () =>
        assertAgencyOrgMatchesClaim("org-a", "org-b"),
      /FORBIDDEN_ORG_OVERRIDE/,
    );
    assert.doesNotThrow(() =>
      assertAgencyOrgMatchesClaim("org-a", "org-a"),
    );
    assert.doesNotThrow(() =>
      assertAgencyOrgMatchesClaim("org-a", undefined),
    );
  });
});
