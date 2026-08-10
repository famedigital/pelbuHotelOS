/**
 * Agent settlement evidence — guide signed paper (photo/file) before leave.
 * Email seal is FO work after guests leave (not a leave gate).
 */

export type GuideSignStatus = "photo" | "waived" | null;

export function bookingNeedsGuideCheckoutEvidence(input: {
  agentId?: string | null;
}): boolean {
  return Boolean((input.agentId ?? "").trim());
}

export function guideEvidenceAllowsLeave(input: {
  agentId?: string | null;
  guideSignStatus?: string | null;
}): boolean {
  if (!bookingNeedsGuideCheckoutEvidence(input)) return true;
  const s = (input.guideSignStatus ?? "").toLowerCase();
  return s === "photo" || s === "waived";
}

export function guideEvidenceBlockMessage(): string {
  return (
    "Agent stay: attach guide-signed settlement paper (camera, scanner file, or PC upload) " +
    "or waive with reason before guests can leave."
  );
}
