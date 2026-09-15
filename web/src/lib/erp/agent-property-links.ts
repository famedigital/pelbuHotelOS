import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const AGENT_PROPERTY_COOKIE = "innora_agent_property";

export type AgentPropertyLinkStatus = "invited" | "approved" | "suspended";

export type AgentPropertyLink = {
  id: string;
  agentId: string;
  propertyId: string;
  status: AgentPropertyLinkStatus;
  rateTier: string;
  creditLimit: number;
  creditUsed: number;
  openRoomCap: number | null;
  propertyName: string;
  propertySlug: string;
};

type LinkRow = {
  id: string;
  agent_id: string;
  property_id: string;
  status: string;
  rate_tier: string;
  credit_limit: number | string;
  credit_used: number | string;
  open_room_cap: number | null;
  properties:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null;
};

function mapLink(row: LinkRow): AgentPropertyLink {
  const prop = Array.isArray(row.properties)
    ? row.properties[0]
    : row.properties;
  return {
    id: row.id,
    agentId: row.agent_id,
    propertyId: row.property_id,
    status: row.status as AgentPropertyLinkStatus,
    rateTier: row.rate_tier || "agents",
    creditLimit: Number(row.credit_limit ?? 0),
    creditUsed: Number(row.credit_used ?? 0),
    openRoomCap:
      row.open_room_cap == null ? null : Number(row.open_room_cap),
    propertyName: prop?.name ?? "Hotel",
    propertySlug: prop?.slug ?? "",
  };
}

const LINK_SELECT =
  "id, agent_id, property_id, status, rate_tier, credit_limit, credit_used, open_room_cap, properties(name, slug)";

export async function loadApprovedAgentLinks(
  admin: Admin,
  agentId: string,
): Promise<AgentPropertyLink[]> {
  const { data, error } = await admin
    .from("agent_property_links")
    .select(LINK_SELECT)
    .eq("agent_id", agentId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as LinkRow[]).map(mapLink);
}

export async function loadAgentLinksForProperty(
  admin: Admin,
  propertyId: string,
  statuses: AgentPropertyLinkStatus[] = ["approved", "invited", "suspended"],
): Promise<AgentPropertyLink[]> {
  const { data, error } = await admin
    .from("agent_property_links")
    .select(LINK_SELECT)
    .eq("property_id", propertyId)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(1200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as LinkRow[]).map(mapLink);
}

export async function getAgentPropertyLink(
  admin: Admin,
  agentId: string,
  propertyId: string,
): Promise<AgentPropertyLink | null> {
  const { data, error } = await admin
    .from("agent_property_links")
    .select(LINK_SELECT)
    .eq("agent_id", agentId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapLink(data as unknown as LinkRow);
}

export async function requireApprovedAgentLink(
  admin: Admin,
  agentId: string,
  propertyId: string,
): Promise<AgentPropertyLink> {
  const link = await getAgentPropertyLink(admin, agentId, propertyId);
  if (!link || link.status !== "approved") {
    throw new Error(
      "This agent is not linked to this hotel for credit. Link them from Agents → Directory.",
    );
  }
  return link;
}

export type UpsertAgentPropertyLinkInput = {
  agentId: string;
  propertyId: string;
  status?: AgentPropertyLinkStatus;
  rateTier?: string;
  creditLimit?: number;
  openRoomCap?: number | null;
  linkedByStaffId?: string | null;
  notes?: string | null;
};

export async function upsertAgentPropertyLink(
  admin: Admin,
  input: UpsertAgentPropertyLinkInput,
): Promise<AgentPropertyLink> {
  const existing = await getAgentPropertyLink(
    admin,
    input.agentId,
    input.propertyId,
  );

  const payload: Record<string, unknown> = {
    agent_id: input.agentId,
    property_id: input.propertyId,
    status: input.status ?? "approved",
    updated_at: new Date().toISOString(),
  };
  if (input.rateTier != null) payload.rate_tier = input.rateTier;
  if (input.creditLimit != null) payload.credit_limit = input.creditLimit;
  if (input.openRoomCap !== undefined) payload.open_room_cap = input.openRoomCap;
  if (input.linkedByStaffId !== undefined) {
    payload.linked_by_staff_id = input.linkedByStaffId;
  }
  if (input.notes !== undefined) payload.notes = input.notes;

  if (!existing) {
    if (payload.rate_tier == null) payload.rate_tier = "agents";
    if (payload.credit_limit == null) payload.credit_limit = 0;
    if (payload.credit_used == null) payload.credit_used = 0;
  }

  const { data, error } = await admin
    .from("agent_property_links")
    .upsert(payload, { onConflict: "agent_id,property_id" })
    .select(LINK_SELECT)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Could not link agent to hotel.");
  }
  return mapLink(data as unknown as LinkRow);
}

export async function updateAgentPropertyLinkCredit(
  admin: Admin,
  args: {
    agentId: string;
    propertyId: string;
    creditUsed?: number;
    creditLimit?: number;
    rateTier?: string;
    openRoomCap?: number | null;
    status?: AgentPropertyLinkStatus;
  },
): Promise<AgentPropertyLink> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (args.creditUsed != null) patch.credit_used = args.creditUsed;
  if (args.creditLimit != null) patch.credit_limit = args.creditLimit;
  if (args.rateTier != null) patch.rate_tier = args.rateTier;
  if (args.openRoomCap !== undefined) patch.open_room_cap = args.openRoomCap;
  if (args.status != null) patch.status = args.status;

  const { data, error } = await admin
    .from("agent_property_links")
    .update(patch)
    .eq("agent_id", args.agentId)
    .eq("property_id", args.propertyId)
    .select(LINK_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "Agent is not linked to this hotel. Link them before changing credit.",
    );
  }
  return mapLink(data as unknown as LinkRow);
}

export function resolveActiveLinkFromCookie(
  links: AgentPropertyLink[],
  cookiePropertyId: string | null | undefined,
): AgentPropertyLink | null {
  if (links.length === 0) return null;
  if (cookiePropertyId) {
    const match = links.find((l) => l.propertyId === cookiePropertyId);
    if (match) return match;
  }
  if (links.length === 1) return links[0]!;
  return null;
}
