/**
 * Canonical FO guest-ledger helpers — one due, one collect-from party.
 * All StayHub / Open bills / settle surfaces should use these.
 */

import {
  guestVisibleBalanceLines,
  netFolioBalance,
  type FolioLineForBalance,
} from "@/lib/folio/balance";

export type { FolioLineForBalance };
export { guestVisibleBalanceLines, netFolioBalance };

/** Alias used in FO architecture docs — same as netFolioBalance. */
export function guestLedgerBalance(lines: FolioLineForBalance[]): number {
  return netFolioBalance(lines);
}

export type CollectParty = "guest" | "agent";

function isAgentBillMode(mode: string | null | undefined): boolean {
  const m = (mode ?? "").toLowerCase();
  return (
    m.includes("agent") ||
    m === "credit" ||
    m === "on_account" ||
    m === "on_credit" ||
    m === "bill_to_agent"
  );
}

/** Who the desk should chase for remaining due. */
export function deriveCollectParty(input: {
  paymentMode?: string | null;
  agentId?: string | null;
}): CollectParty {
  if (input.agentId && isAgentBillMode(input.paymentMode)) return "agent";
  return "guest";
}

export function isGuestPayAtLeave(paymentMode?: string | null): boolean {
  return deriveCollectParty({ paymentMode, agentId: null }) === "guest";
}
