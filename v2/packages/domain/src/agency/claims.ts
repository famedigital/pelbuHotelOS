/** Portal claim helpers (M01) — no I/O. */

export type AgencyActorClaims = {
  agencyOrgId?: string | null;
  role?: string | null;
};

export function agencyOrgIdFromActor(actor: AgencyActorClaims): string {
  const id = String(actor.agencyOrgId ?? "").trim();
  if (!id) {
    throw new Error("NO_AGENCY_ORG");
  }
  return id;
}

/** Client-supplied org id must match claims or be absent. */
export function assertAgencyOrgMatchesClaim(
  claimOrgId: string,
  bodyOrgId: string | null | undefined,
): void {
  if (bodyOrgId != null && String(bodyOrgId).trim() !== claimOrgId) {
    throw new Error("FORBIDDEN_ORG_OVERRIDE");
  }
}
