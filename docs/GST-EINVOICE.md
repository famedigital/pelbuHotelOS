# Bhutan GST e-invoice (DRC / RRCO)

**Status:** Interface + stub only. Do **not** claim live RRCO submission.

## What we ship today

- Internal gapless fiscal sequences: `INV-` / `RCP-` / `CN-YYYY-####` via `fiscal_documents` + `property_sequences`.
- Printable desk PDFs from `/erp/invoices/[id]/print` and folio receipt routes.
- Adapter: `web/src/lib/fiscal/drc-einvoice.ts` (`StubBhutanEinvoiceClient`).

## When DRC mandates

1. Obtain API base URL, client credentials, and schema from DRC / RRCO.
2. Set env: `BHUTAN_EINVOICE_LIVE=1` plus future `BHUTAN_EINVOICE_API_KEY` / base (not invented here).
3. Replace stub `submit()` with real HTTP; keep `validate()` as preflight.
4. Call from `issueFiscalDocument` after successful local issue (idempotent external ref on `fiscal_documents.meta`).
5. Re-run Finance UAT + GST export spot-check.

Until then, `submit()` returns `not_configured` and internal sequences remain the audit record.

## Related

- [FINANCE-UAT.md](FINANCE-UAT.md) — journal edge proof + GST sign-off
- [FEATURES.md](FEATURES.md) — GST / fiscal status
- [WHITEBOARD.md](WHITEBOARD.md) — residual ops map
- [OPS-RUNBOOK.md](OPS-RUNBOOK.md) — night audit / payments
