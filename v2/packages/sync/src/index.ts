/**
 * Offline drafts only — money commands must never queue here (REINVENT).
 */
export type DraftKind = "reservation_draft" | "pos_ticket_draft";

export type DraftRecord = {
  id: string;
  kind: DraftKind;
  propertyId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
};

const MONEY_KINDS = new Set([
  "folio_charge",
  "folio_payment",
  "checkout",
  "night_audit",
  "fiscal_issue",
]);

export function assertDraftAllowed(kind: string): void {
  if (MONEY_KINDS.has(kind) || kind.includes("payment") || kind.includes("charge")) {
    throw new Error(`Money op "${kind}" cannot be queued offline — online only`);
  }
}

export class MemoryDraftStore {
  private drafts = new Map<string, DraftRecord>();

  put(draft: Omit<DraftRecord, "updatedAt">): DraftRecord {
    assertDraftAllowed(draft.kind);
    const row: DraftRecord = { ...draft, updatedAt: new Date().toISOString() };
    this.drafts.set(draft.id, row);
    return row;
  }

  list(propertyId: string): DraftRecord[] {
    return [...this.drafts.values()].filter((d) => d.propertyId === propertyId);
  }
}
