/**
 * Bilateral Hotel ↔ Agent MoU lifecycle (v2 desk + Hermes gate).
 * Either party may propose; inventory/book/edit require status === "active".
 */
import { create } from "zustand";
import { useCommercialStore } from "./commercial-store";

export type MouStatus =
  | "draft"
  | "pending_counterparty"
  | "active"
  | "suspended"
  | "expired"
  | "rejected";

export type MouInitiator = "hotel" | "agent";

export type MouLink = {
  id: string;
  propertyId: string;
  propertyName: string;
  agentId: string;
  agentName: string;
  status: MouStatus;
  initiatedBy: MouInitiator;
  proposedByActor: string;
  decidedByActor: string | null;
  proposedAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
  creditLimitBtn: number;
  /** MoU rate card assigned for this hotel↔agent pair (falls back to Agent.rateCardId). */
  rateCardId: string | null;
  notes: string;
};

type MouState = {
  links: MouLink[];
  propose: (input: {
    propertyId: string;
    propertyName: string;
    agentId: string;
    initiatedBy: MouInitiator;
    actor: string;
    creditLimitBtn?: number;
    notes?: string;
    expiresAt?: string | null;
  }) => { ok: true; link: MouLink } | { ok: false; error: string };
  decide: (
    id: string,
    decision: "active" | "rejected",
    actor: string,
  ) => { ok: true; link: MouLink } | { ok: false; error: string };
  suspend: (
    id: string,
    actor: string,
  ) => { ok: true; link: MouLink } | { ok: false; error: string };
  activeForAgent: (agentId: string, propertyId?: string) => MouLink[];
  hasActiveMou: (agentId: string, propertyId: string) => boolean;
  pendingForAgent: (agentId: string) => MouLink[];
  pendingForProperty: (propertyId: string) => MouLink[];
};

const DEMO_PROPERTY_ID = "00000000-0000-4000-8000-000000000001";
/** Second connected hotel for agency multi-property portfolio demos. */
const PARO_PROPERTY_ID = "00000000-0000-4000-8000-000000000002";

function seedLinks(): MouLink[] {
  const agents = useCommercialStore.getState().agents;
  const yap = agents.find((a) => a.id === "ag-yap") ?? agents[0];
  const druk = agents.find((a) => a.id === "ag-da");
  const bp = agents.find((a) => a.id === "ag-bp");
  const now = new Date().toISOString();
  const links: MouLink[] = [];
  if (yap) {
    links.push(
      {
        id: "mou-yap-demo",
        propertyId: DEMO_PROPERTY_ID,
        propertyName: "Demo Hotel · Thimphu",
        agentId: yap.id,
        agentName: yap.name,
        status: "active",
        initiatedBy: "hotel",
        proposedByActor: "GM · Desk",
        decidedByActor: yap.name,
        proposedAt: now,
        decidedAt: now,
        expiresAt: null,
        creditLimitBtn: yap.creditLimit ?? 200_000,
        rateCardId: yap.rateCardId,
        notes: "Flagship MoU — primary inventory & rates",
      },
      {
        id: "mou-yap-paro",
        propertyId: PARO_PROPERTY_ID,
        propertyName: "Paro Valley Suites",
        agentId: yap.id,
        agentName: yap.name,
        status: "active",
        initiatedBy: "agent",
        proposedByActor: yap.name,
        decidedByActor: "Paro GM",
        proposedAt: now,
        decidedAt: now,
        expiresAt: null,
        creditLimitBtn: 120_000,
        rateCardId: yap.rateCardId,
        notes: "Second hotel in Yangphel portfolio",
      },
    );
  }
  if (druk) {
    links.push({
      id: "mou-da-demo",
      propertyId: DEMO_PROPERTY_ID,
      propertyName: "Demo Hotel · Thimphu",
      agentId: druk.id,
      agentName: druk.name,
      status: "active",
      initiatedBy: "agent",
      proposedByActor: druk.name,
      decidedByActor: "GM · Desk",
      proposedAt: now,
      decidedAt: now,
      expiresAt: null,
      creditLimitBtn: druk.creditLimit ?? 150_000,
      rateCardId: druk.rateCardId,
      notes: "Seeded active MoU",
    });
  }
  if (bp) {
    links.push({
      id: "mou-bp-pending",
      propertyId: DEMO_PROPERTY_ID,
      propertyName: "Demo Hotel · Thimphu",
      agentId: bp.id,
      agentName: bp.name,
      status: "pending_counterparty",
      initiatedBy: "hotel",
      proposedByActor: "GM · Desk",
      decidedByActor: null,
      proposedAt: now,
      decidedAt: null,
      expiresAt: null,
      creditLimitBtn: bp.creditLimit ?? 80_000,
      rateCardId: bp.rateCardId,
      notes: "Awaiting Blue Poppy counter-sign",
    });
  }
  return links;
}

export const useMouStore = create<MouState>((set, get) => ({
  links: seedLinks(),

  propose: (input) => {
    const agent = useCommercialStore.getState().agents.find((a) => a.id === input.agentId);
    if (!agent) return { ok: false, error: "Agent not found" };
    const existing = get().links.find(
      (l) =>
        l.agentId === input.agentId &&
        l.propertyId === input.propertyId &&
        (l.status === "active" || l.status === "pending_counterparty" || l.status === "draft"),
    );
    if (existing?.status === "active") {
      return { ok: false, error: "Active MoU already exists for this hotel" };
    }
    if (existing?.status === "pending_counterparty") {
      return { ok: false, error: "MoU already awaiting counterparty" };
    }
    const link: MouLink = {
      id: crypto.randomUUID(),
      propertyId: input.propertyId,
      propertyName: input.propertyName,
      agentId: agent.id,
      agentName: agent.name,
      status: "pending_counterparty",
      initiatedBy: input.initiatedBy,
      proposedByActor: input.actor,
      decidedByActor: null,
      proposedAt: new Date().toISOString(),
      decidedAt: null,
      expiresAt: input.expiresAt ?? null,
      creditLimitBtn: input.creditLimitBtn ?? agent.creditLimit ?? 100_000,
      rateCardId: agent.rateCardId,
      notes: input.notes?.trim() ?? "",
    };
    set((s) => ({
      links: [
        link,
        ...s.links.filter(
          (l) => !(l.agentId === link.agentId && l.propertyId === link.propertyId && l.status === "draft"),
        ),
      ],
    }));
    return { ok: true, link };
  },

  decide: (id, decision, actor) => {
    const row = get().links.find((l) => l.id === id);
    if (!row) return { ok: false, error: "MoU not found" };
    if (row.status !== "pending_counterparty" && row.status !== "draft") {
      return { ok: false, error: "MoU is not awaiting a decision" };
    }
    const next: MouLink = {
      ...row,
      status: decision,
      decidedByActor: actor,
      decidedAt: new Date().toISOString(),
    };
    set((s) => ({
      links: s.links.map((l) => (l.id === id ? next : l)),
    }));
    return { ok: true, link: next };
  },

  suspend: (id, actor) => {
    const row = get().links.find((l) => l.id === id);
    if (!row) return { ok: false, error: "MoU not found" };
    if (row.status !== "active") return { ok: false, error: "Only active MoUs can be suspended" };
    const next: MouLink = {
      ...row,
      status: "suspended",
      decidedByActor: actor,
      decidedAt: new Date().toISOString(),
    };
    set((s) => ({
      links: s.links.map((l) => (l.id === id ? next : l)),
    }));
    return { ok: true, link: next };
  },

  activeForAgent: (agentId, propertyId) =>
    get().links.filter(
      (l) =>
        l.agentId === agentId &&
        l.status === "active" &&
        (!propertyId || l.propertyId === propertyId),
    ),

  hasActiveMou: (agentId, propertyId) =>
    get().links.some(
      (l) =>
        l.agentId === agentId &&
        l.propertyId === propertyId &&
        l.status === "active",
    ),

  pendingForAgent: (agentId) =>
    get().links.filter(
      (l) => l.agentId === agentId && l.status === "pending_counterparty",
    ),

  pendingForProperty: (propertyId) =>
    get().links.filter(
      (l) => l.propertyId === propertyId && l.status === "pending_counterparty",
    ),
}));

export const DEMO_MOU_PROPERTY_ID = DEMO_PROPERTY_ID;
export const PARO_MOU_PROPERTY_ID = PARO_PROPERTY_ID;
