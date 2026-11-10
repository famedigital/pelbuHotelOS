import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BANK_PROOF_PENDING,
  canConfirmBankPayment,
  canConfirmDepositLink,
  canSubmitDepositProof,
  canSubmitFolioBankProof,
  skipsLedgerUntilConfirmed,
} from "./bank-proof-flow";

describe("bank-proof-flow", () => {
  it("guest submits proof only on open deposit link", () => {
    assert.equal(canSubmitDepositProof("open"), true);
    assert.equal(canSubmitDepositProof(BANK_PROOF_PENDING), false);
    assert.equal(canSubmitDepositProof("paid"), false);
  });

  it("desk confirms only pending_bank deposit links", () => {
    assert.equal(canConfirmDepositLink(BANK_PROOF_PENDING), true);
    assert.equal(canConfirmDepositLink("open"), false);
  });

  it("folio bank proof requires open folio", () => {
    assert.equal(canSubmitFolioBankProof("open"), true);
    assert.equal(canSubmitFolioBankProof("closed"), false);
  });

  it("finance queue confirms pending_bank payments only", () => {
    assert.equal(canConfirmBankPayment(BANK_PROOF_PENDING), true);
    assert.equal(canConfirmBankPayment("confirmed"), false);
    assert.equal(canConfirmBankPayment(null), false);
  });

  it("pending_bank skips ledger until confirmed", () => {
    assert.equal(skipsLedgerUntilConfirmed(BANK_PROOF_PENDING), true);
    assert.equal(skipsLedgerUntilConfirmed("confirmed"), false);
  });
});
