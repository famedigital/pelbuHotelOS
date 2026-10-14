import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingNeedsGuideCheckoutEvidence,
  guideEvidenceAllowsLeave,
  guideEvidenceBlockMessage,
  guideScanStillMissing,
} from "@/lib/agents/guide-checkout";

test("agent stay needs guide evidence", () => {
  assert.equal(bookingNeedsGuideCheckoutEvidence({ agentId: "a1" }), true);
  assert.equal(bookingNeedsGuideCheckoutEvidence({ agentId: null }), false);
  assert.equal(bookingNeedsGuideCheckoutEvidence({ agentId: "" }), false);
});

test("leave when signed, photo, or waived", () => {
  assert.equal(
    guideEvidenceAllowsLeave({ agentId: "a1", guideSignStatus: null }),
    false,
  );
  assert.equal(
    guideEvidenceAllowsLeave({ agentId: "a1", guideSignStatus: "signed" }),
    true,
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

test("scan reminder is only the signed-without-file state", () => {
  assert.equal(
    guideScanStillMissing({ guideSignStatus: "signed", guideSignPhotoPublicId: null }),
    true,
  );
  assert.equal(
    guideScanStillMissing({
      guideSignStatus: "photo",
      guideSignPhotoPublicId: "pelbu/scan",
    }),
    false,
  );
  assert.equal(
    guideScanStillMissing({ guideSignStatus: "waived", guideSignPhotoPublicId: null }),
    false,
  );
});

test("block message is staff-readable", () => {
  assert.match(guideEvidenceBlockMessage(), /Guide signed/);
});
