/**
 * Agent lifecycle statuses and desk eligibility helpers.
 *
 * | status      | Bookable | Agent credit / portal / limit |
 * |-------------|----------|-------------------------------|
 * | approved    | yes      | yes                           |
 * | demo        | yes      | yes                           |
 * | directory   | yes      | no (TCB listing only)         |
 * | pending     | no       | no                            |
 * | rejected    | no       | no                            |
 *
 * TCB import uses status=directory so operators attach on bookings without
 * becoming trade/credit partners. Promote via Agents or CreditAgentPromotePanel.
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

/**
 * Human-readable why agent credit is blocked (null when eligible).
 * Prefer this over a generic "approved or demo" string so FO sees
 * directory vs pending vs rejected and knows the next step.
 */
export function creditAgentIneligibilityMessage(
  status: string,
  companyName?: string | null,
): string | null {
  if (isCreditAgentStatus(status)) return null;
  const who = companyName?.trim()
    ? `"${companyName.trim()}"`
    : "This agent";
  const st = status || "unknown";

  if (st === "directory") {
    return (
      `${who} is a TCB directory listing (status: directory), not a trade partner. ` +
      `Agent credit requires status approved or demo. ` +
      `Enable credit here (rate tier + limit), on the booking form, or on /erp/agents.`
    );
  }
  if (st === "pending") {
    return (
      `${who} is still pending approval (status: pending). ` +
      `Approve as a trade partner before agent credit.`
    );
  }
  if (st === "rejected") {
    return (
      `${who} was rejected and cannot use agent credit. ` +
      `Re-open them from Agents first.`
    );
  }
  return (
    `${who} cannot use agent credit (status: ${st}). ` +
    `Only approved or demo trade partners can. Directory listings must be promoted first.`
  );
}
