/**
 * Agent settlement evidence — staff confirm the guide signed, then upload the scan later.
 * Email seal is FO work after guests leave (not a leave gate).
 */

export type GuideSignStatus = "photo" | "signed" | "waived" | null;

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
  return s === "photo" || s === "signed" || s === "waived";
}

/** Checkbox ticked, scan file still missing. */
export function guideScanStillMissing(input: {
  guideSignStatus?: string | null;
  guideSignPhotoPublicId?: string | null;
}): boolean {
  if ((input.guideSignStatus ?? "").toLowerCase() !== "signed") return false;
  return !(input.guideSignPhotoPublicId ?? "").trim();
}

export function guideEvidenceBlockMessage(): string {
  return (
    "Tick “Guide signed the settlement” before guests leave. " +
    "Upload the scan later, or waive if the guide already left."
  );
}
