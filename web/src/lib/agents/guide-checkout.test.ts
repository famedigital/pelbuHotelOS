import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingNeedsGuideCheckoutEvidence,
  guideEvidenceAllowsLeave,
  guideEvidenceBlockMessage,
} from "@/lib/agents/guide-checkout";

test("agent stay needs guide evidence", () => {
  assert.equal(bookingNeedsGuideCheckoutEvidence({ agentId: "a1" }), true);
  assert.equal(bookingNeedsGuideCheckoutEvidence({ agentId: null }), false);
  assert.equal(bookingNeedsGuideCheckoutEvidence({ agentId: "" }), false);
});

test("leave only when photo or waived", () => {
  assert.equal(
    guideEvidenceAllowsLeave({ agentId: "a1", guideSignStatus: null }),
    false,
  );
  assert.equal(
    guideEvidenceAllowsLeave({ agentId: "a1", guideSignStatus: "photo" }),
    true,
  );
  assert.equal(
    guideEvidenceAllowsLeave({ agentId: "a1", guideSignStatus: "waived" }),
    true,
  );
  assert.equal(
    guideEvidenceAllowsLeave({ agentId: null, guideSignStatus: null }),
    true,
  );
});

test("block message is staff-readable", () => {
  assert.match(guideEvidenceBlockMessage(), /guide-signed/);
});
