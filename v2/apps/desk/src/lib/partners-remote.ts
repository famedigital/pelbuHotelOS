import { apiGet, sessionPropertyId } from "./api";
import { useCommercialStore } from "./commercial-store";
import { useExtrasStore } from "./extras-store";

export type PartnersSnapshotAgent = {
  id: string;
  name: string;
  code: string;
  creditLimit: number;
  creditHold: boolean;
  contact: string;
  status: string;
};

export type PartnersSnapshotGuide = {
  id: string;
  name: string;
  tcr: string;
  phone: string;
  languages: string;
  verified: boolean;
  active: boolean;
};

export type PartnersHydrateResult =
  | {
      ok: true;
      agents: number;
      guides: number;
    }
  | { ok: false; error: string };

/**
 * Pull v2.agents + v2.tour_guides for the session property into desk stores.
 * Seeds remain only when API fails / empty (offline empty fallback).
 */
export async function hydratePartnersRemote(): Promise<PartnersHydrateResult> {
  try {
    const propertyId = sessionPropertyId();
    const res = await apiGet<{
      ok: boolean;
      error?: string;
      agents?: PartnersSnapshotAgent[];
      guides?: PartnersSnapshotGuide[];
    }>(`/v1/partners/snapshot?propertyId=${encodeURIComponent(propertyId)}`);
    if (!res.ok) {
      return { ok: false, error: res.error ?? "Partners hydrate failed" };
    }
    const agents = res.agents ?? [];
    const guides = res.guides ?? [];
    if (agents.length > 0) {
      useCommercialStore.getState().hydrateAgents(agents);
    }
    if (guides.length > 0) {
      useExtrasStore.getState().hydrateGuides(guides);
    }
    return { ok: true, agents: agents.length, guides: guides.length };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Partners hydrate failed";
    console.error("[partners-remote] hydrate failed", err);
    return { ok: false, error: message };
  }
}
