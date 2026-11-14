/**
 * Innora-connected hotels for partner portal — portal session first, MoU second.
 * Never default live agents onto Demo Hotel / seed shells.
 */
import type { Agent } from "./commercial-store";
import type { SessionProperty } from "./auth-session";
import {
  DEMO_MOU_PROPERTY_ID,
  PARO_MOU_PROPERTY_ID,
  type MouLink,
  type MouStatus,
} from "./mou-store";
import type { ConnectedHotelRow } from "./b2b-portfolio";

export type InnoraHotelOption = {
  propertyId: string;
  propertyName: string;
  slug: string;
  mouStatus: MouStatus;
};

const DEMO_PROPERTY_IDS = new Set([DEMO_MOU_PROPERTY_ID, PARO_MOU_PROPERTY_ID]);

export function isDemoOrSeedProperty(input: {
  id?: string;
  slug?: string;
  name?: string;
}): boolean {
  const id = String(input.id ?? "");
  const slug = String(input.slug ?? "").toLowerCase();
  const name = String(input.name ?? "").toLowerCase();
  if (DEMO_PROPERTY_IDS.has(id)) return true;
  if (slug === "demo-hotel" || name === "demo" || name === "demo hotel") return true;
  if (slug.includes("seed") || name.includes("seed archive")) return true;
  return false;
}

export function resolveInnoraHotels(input: {
  portalProperties?: SessionProperty[];
  portalProperty?: SessionProperty | null;
  mouLinks: MouLink[];
  agentId: string;
}): InnoraHotelOption[] {
  const byId = new Map<string, InnoraHotelOption>();

  const portalList = [
    ...(input.portalProperties ?? []),
    ...(input.portalProperty ? [input.portalProperty] : []),
  ];
  for (const p of portalList) {
    if (!p?.id || isDemoOrSeedProperty(p)) continue;
    byId.set(p.id, {
      propertyId: p.id,
      propertyName: p.name,
      slug: p.slug,
      mouStatus: "active",
    });
  }

  for (const link of input.mouLinks) {
    if (link.agentId !== input.agentId) continue;
    if (isDemoOrSeedProperty({ id: link.propertyId, name: link.propertyName })) {
      continue;
    }
    const prev = byId.get(link.propertyId);
    if (!prev || statusRank(link.status) > statusRank(prev.mouStatus)) {
      byId.set(link.propertyId, {
        propertyId: link.propertyId,
        propertyName: link.propertyName,
        slug: prev?.slug ?? "",
        mouStatus: link.status,
      });
    }
  }

  let rows = [...byId.values()];
  /* If we only have demo MoUs and no portal hotels, fall back so local demos still work. */
  if (rows.length === 0) {
    for (const link of input.mouLinks) {
      if (link.agentId !== input.agentId) continue;
      rows.push({
        propertyId: link.propertyId,
        propertyName: link.propertyName,
        slug: "",
        mouStatus: link.status,
      });
    }
  }

  return rows.sort((a, b) => a.propertyName.localeCompare(b.propertyName));
}

function statusRank(s: MouStatus): number {
  if (s === "active") return 5;
  if (s === "pending_counterparty") return 4;
  if (s === "draft") return 3;
  if (s === "suspended") return 2;
  if (s === "expired") return 1;
  return 0;
}

/** Prefer portal/live hotels when merging ConnectedHotelRow lists. */
export function mergeConnectedHotels(
  fromPortfolio: ConnectedHotelRow[],
  innora: InnoraHotelOption[],
  agent: Agent | null,
): ConnectedHotelRow[] {
  const liveInnora = innora.filter(
    (h) => !isDemoOrSeedProperty({ id: h.propertyId, name: h.propertyName, slug: h.slug }),
  );
  const preferLive = liveInnora.length > 0;

  const byId = new Map<string, ConnectedHotelRow>();
  for (const h of fromPortfolio) {
    if (preferLive && isDemoOrSeedProperty({ id: h.propertyId, name: h.propertyName })) {
      continue;
    }
    byId.set(h.propertyId, h);
  }
  for (const h of preferLive ? liveInnora : innora) {
    if (byId.has(h.propertyId)) continue;
    byId.set(h.propertyId, {
      propertyId: h.propertyId,
      propertyName: h.propertyName,
      mouStatus: h.mouStatus,
      creditLimitBtn: agent?.creditLimit ?? 200_000,
      rateCardId: agent?.rateCardId ?? null,
      rateCardCode: "AGT-COMMON",
      doubleNet: null,
      offerCount: 0,
      staysHeld: 0,
      staysInHouse: 0,
      staysArriving: 0,
      arOutstanding: 0,
      paidTotal: 0,
      mouId: `portal-${h.propertyId}`,
    });
  }
  return [...byId.values()].sort((a, b) =>
    a.propertyName.localeCompare(b.propertyName),
  );
}

export function preferInnoraHotelId(
  hotels: InnoraHotelOption[],
  hinted?: string | null,
): string {
  if (hinted && hotels.some((h) => h.propertyId === hinted)) return hinted;
  const live = hotels.filter(
    (h) => !isDemoOrSeedProperty({ id: h.propertyId, name: h.propertyName, slug: h.slug }),
  );
  const pool = live.length > 0 ? live : hotels;
  return (
    pool.find((h) => h.slug === "pelbu-olakha")?.propertyId ||
    pool.find((h) => /pelbu/i.test(h.slug) || /pelbu/i.test(h.propertyName))
      ?.propertyId ||
    pool[0]?.propertyId ||
    ""
  );
}

/**
 * Map portal subjectId → commercial Agent.
 * Live agents use UUID subject ids that are not in the demo agent gallery.
 */
export function resolvePartnerAgent(
  agents: Agent[],
  subjectId: string,
  meta: { displayName: string; loginCode: string },
): Agent {
  const byId = agents.find((a) => a.id === subjectId);
  if (byId) return byId;

  const code = meta.loginCode.trim().toUpperCase();
  const byCode = agents.find(
    (a) =>
      a.code.toUpperCase() === code ||
      a.code.toUpperCase() === "ST" ||
      (code.includes("SOUL") && /soul/i.test(a.name)),
  );
  if (byCode) {
    return {
      ...byCode,
      id: subjectId,
      name: meta.displayName || byCode.name,
      code: code || byCode.code,
    };
  }

  const template = agents.find((a) => a.rateCardId === "rc-agt-common") ?? agents[0];
  return {
    id: subjectId,
    name: meta.displayName || "Partner",
    code: code || "AGT",
    contact: "",
    creditLimit: template?.creditLimit ?? 200_000,
    usedCredit: 0,
    termsDays: template?.termsDays ?? 30,
    rateCardId: template?.rateCardId ?? "rc-agt-common",
    aging: { current: 0, d30: 0, d60: 0, d90: 0 },
    active: true,
  };
}
