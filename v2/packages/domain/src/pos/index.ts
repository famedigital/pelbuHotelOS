/**
 * POS sell-path rules — COPY tenders / void discipline; REINVENT server prices.
 * Room charge → folio line, no fiscal INV. Walk-in settle → gapless INV.
 */

export type PosTenderKind =
  | "cash"
  | "card"
  | "rma_qr"
  | "city_ledger"
  | "room_charge"
  | "agent";

export type SettleFiscalOutcome =
  | { issueInv: true; reason: "walk_in_settle" }
  | { issueInv: false; reason: "room_charge_folio_only" | "agent_ar_deferred" };

/** Reject client-sent price fields on add-item payloads. */
export function assertNoClientPrice(raw: unknown): {
  ok: true;
} | { ok: false; error: string; code: "POS_PRICE" } {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if ("unitPrice" in o || "price" in o || "netPrice" in o || "unit_price" in o) {
      return {
        ok: false,
        error: "Client must not send price; server menu price only",
        code: "POS_PRICE",
      };
    }
  }
  return { ok: true };
}

/** Resolve line net from server catalog — never trust client. */
export function resolveServerLineNet(args: {
  menuNetPrice: number | null | undefined;
  qty: number;
}): { ok: true; lineNet: number } | { ok: false; error: string } {
  if (args.menuNetPrice == null || !Number.isFinite(args.menuNetPrice) || args.menuNetPrice < 0) {
    return { ok: false, error: "Menu item has no server price" };
  }
  if (!Number.isInteger(args.qty) || args.qty < 1) {
    return { ok: false, error: "Quantity must be a positive integer" };
  }
  return { ok: true, lineNet: Math.round(args.menuNetPrice * args.qty * 100) / 100 };
}

export function settleFiscalForTender(tender: PosTenderKind): SettleFiscalOutcome {
  if (tender === "room_charge") {
    return { issueInv: false, reason: "room_charge_folio_only" };
  }
  if (tender === "agent" || tender === "city_ledger") {
    return { issueInv: false, reason: "agent_ar_deferred" };
  }
  return { issueInv: true, reason: "walk_in_settle" };
}

export function assertVoidPin(args: {
  pinProvided: string | null | undefined;
  expectedPin: string;
}): { ok: true } | { ok: false; error: string; code: "PIN" } {
  if (!args.pinProvided || args.pinProvided !== args.expectedPin) {
    return { ok: false, error: "Manager PIN required to void", code: "PIN" };
  }
  return { ok: true };
}

export function assertCashTender(args: {
  totalBtn: number;
  cashGivenBtn: number;
}): { ok: true; changeBtn: number } | { ok: false; error: string } {
  if (args.cashGivenBtn + 1e-9 < args.totalBtn) {
    return {
      ok: false,
      error: `Cash short — need ${args.totalBtn}, got ${args.cashGivenBtn}`,
    };
  }
  return {
    ok: true,
    changeBtn: Math.round((args.cashGivenBtn - args.totalBtn) * 100) / 100,
  };
}

/** Split check by amount — remainder stays on primary. */
export function splitAmount(
  totalBtn: number,
  splitBtn: number,
): { ok: true; primaryBtn: number; splitBtn: number } | { ok: false; error: string } {
  if (!(splitBtn > 0) || splitBtn >= totalBtn) {
    return { ok: false, error: "Split amount must be between 0 and total" };
  }
  return {
    ok: true,
    primaryBtn: Math.round((totalBtn - splitBtn) * 100) / 100,
    splitBtn: Math.round(splitBtn * 100) / 100,
  };
}
