import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Pure rollback decision helpers — mirrors gateway control flow for unit tests
 * without requiring a live Supabase client.
 */
function shouldRollbackPayment(args: {
  paymentInserted: boolean;
  folioLineOk: boolean;
  glOk: boolean;
}): "keep" | "delete_payment" | "delete_payment_and_line" {
  if (!args.paymentInserted) return "keep";
  if (!args.folioLineOk) return "delete_payment";
  if (!args.glOk) return "delete_payment_and_line";
  return "keep";
}

describe("postFolioPaymentRecord rollback decisions", () => {
  it("keeps rows when GL succeeds", () => {
    assert.equal(
      shouldRollbackPayment({
        paymentInserted: true,
        folioLineOk: true,
        glOk: true,
      }),
      "keep",
    );
  });

  it("deletes payment when folio line fails", () => {
    assert.equal(
      shouldRollbackPayment({
        paymentInserted: true,
        folioLineOk: false,
        glOk: false,
      }),
      "delete_payment",
    );
  });

  it("deletes payment and line when GL fails", () => {
    assert.equal(
      shouldRollbackPayment({
        paymentInserted: true,
        folioLineOk: true,
        glOk: false,
      }),
      "delete_payment_and_line",
    );
  });
});

function resolveIdempotencyCollision(args: {
  hasKey: boolean;
  errorCode: string;
  existingPaymentId?: string;
}): "retry_lookup" | "throw" {
  if (args.errorCode === "23505" && args.hasKey && args.existingPaymentId) {
    return "retry_lookup";
  }
  return "throw";
}

describe("payment idempotency collision handling", () => {
  it("treats unique violation as success when row exists", () => {
    assert.equal(
      resolveIdempotencyCollision({
        hasKey: true,
        errorCode: "23505",
        existingPaymentId: "pay-1",
      }),
      "retry_lookup",
    );
  });

  it("throws on duplicate without idempotency key", () => {
    assert.equal(
      resolveIdempotencyCollision({
        hasKey: false,
        errorCode: "23505",
      }),
      "throw",
    );
  });
});
