/**
 * Agent lifecycle statuses and desk eligibility helpers.
 *
 * - directory: TCB/public listings — attach to bookings, no credit/portal/nets
 * - approved / demo: full trade partners (credit + portal when enabled)
 * - pending / rejected: applications only
 */

export const AGENT_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "demo",
  "directory",
] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** Statuses FO can attach to a booking (searchable pickers). */
export const BOOKABLE_AGENT_STATUSES = [
  "approved",
  "demo",
  "directory",
] as const;

export type BookableAgentStatus = (typeof BOOKABLE_AGENT_STATUSES)[number];

/** Statuses allowed for on_credit, credit ledger, and agent portal login. */
export const CREDIT_AGENT_STATUSES = ["approved", "demo"] as const;

export type CreditAgentStatus = (typeof CREDIT_AGENT_STATUSES)[number];

export function isAgentStatus(value: string): value is AgentStatus {
  return (AGENT_STATUSES as readonly string[]).includes(value);
}

export function isBookableAgentStatus(
  value: string,
): value is BookableAgentStatus {
  return (BOOKABLE_AGENT_STATUSES as readonly string[]).includes(value);
}

export function isCreditAgentStatus(
  value: string,
): value is CreditAgentStatus {
  return (CREDIT_AGENT_STATUSES as readonly string[]).includes(value);
}
