/**
 * OPERATIONS-FLOW §5.2 — Walk-in FIT money spine (domain gate).
 * Full UI/API journey lives in desk Playwright; this locks ledger invariants.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertPersonalFolioCleared } from "./dual-folio.js";
import { assertGuestIdDocument } from "./guest-id.js";
import { quoteNight } from "../tax/index.js";
import { formatConfirmationNo, formatPsbn } from "../numbering/index.js";
import { settleFiscalForTender } from "../pos/index.js";

describe("FO FIT journey §5.2 money spine", () => {
  it("quotes room night with SC→GST chain", () => {
    const q = quoteNight(5000, "net");
    assert.equal(q.totalBtn, 5775);
    assert.equal(q.serviceChargeBtn, 500);
    assert.ok(q.gstBtn > 0);
  });

  it("blocks checkout while personal folio has due", () => {
    const blocked = assertPersonalFolioCleared([
      { payerType: "guest", balanceBtn: 5775 },
      { payerType: "agent", balanceBtn: 0 },
    ]);
    assert.equal(blocked.ok, false);
  });

  it("allows checkout after personal settle; master may remain open", () => {
    const cleared = assertPersonalFolioCleared([
      { payerType: "guest", balanceBtn: 0 },
      { payerType: "agent", balanceBtn: 50_000 },
    ]);
    assert.equal(cleared.ok, true);
  });

  it("mBoB / cash settle issues fiscal INV; room charge does not", () => {
    assert.equal(settleFiscalForTender("cash").issueInv, true);
    assert.equal(settleFiscalForTender("room_charge").issueInv, false);
  });

  it("confirmation + PSBN formats are gapless-sequence ready", () => {
    assert.match(formatConfirmationNo("PS", 1402, 2026), /^PS-2026-\d+$/);
    assert.match(formatPsbn(88, 2026), /^PSBN-2026-\d+$/);
  });

  it("blocks check-in without passport/CID capture", () => {
    assert.equal(assertGuestIdDocument("Pending").ok, false);
    assert.equal(assertGuestIdDocument("").ok, false);
    const ok = assertGuestIdDocument("P-BT-998877");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.documentRef, "P-BT-998877");
  });
});