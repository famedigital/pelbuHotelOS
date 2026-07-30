-- Harden finance import RPCs: service_role only (no anon/authenticated execute).
revoke all on function finance_claim_import_batch(text, text[]) from public, anon, authenticated;
revoke all on function finance_commit_receipt_batch(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function finance_commit_bank_batch(uuid, uuid, text) from public, anon, authenticated;
grant execute on function finance_claim_import_batch(text, text[]) to service_role;
grant execute on function finance_commit_receipt_batch(uuid, uuid, boolean, text) to service_role;
grant execute on function finance_commit_bank_batch(uuid, uuid, text) to service_role;
