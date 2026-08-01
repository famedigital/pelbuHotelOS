# Finance UAT pack (Pelbu Olakha)

Run after Ops + Money waves. Desk property = Pelbu Suites Olakha.

## Period close

1. Open `/erp/finance/accounting` — confirm current month period is **open**.
2. Post one expense + one folio payment in the period.
3. Soft-close period (if UI present) — verify new posts require manager override.
4. Hard-close period — verify posts reject without override; override with reason + PIN audits.

## GST return export

1. Open `/erp/finance/gst`.
2. Export / view GST for the current month.
3. Confirm invoice `INV-YYYY-####` and any `CN-YYYY-####` credit notes appear.
4. Spot-check one folio: line GST totals match fiscal document.

## Bank recon unmatched queue

1. Open `/erp/finance` banking / recon section.
2. Import a statement (or use existing unmatched rows).
3. Auto-match where possible; leave at least one unmatched.
4. Manually match one unmatched txn to a payment or expense.
5. Confirm unmatched queue shrinks and audit trail records the match.

## Edge journal proof (code)

Automated: `npm test` covers `proveEdgeJournals` for folio charge, payment, void reverse, comp, laundry (balanced XOR lines).

Desk spot-check (initials required — cannot invent prod UAT):

1. Post room charge → journal balanced under AR / room revenue.
2. Post payment → cash/bank vs AR.
3. Void a line → reverse journal.
4. Comp → expense vs AR.
5. Laundry via gateway → laundry revenue vs AR.

| Edge path | Pass | Initials |
|-----------|------|----------|
| Folio charge journal | ☐ | |
| Folio payment journal | ☐ | |
| Void reverse journal | ☐ | |
| Comp journal | ☐ | |
| Laundry journal | ☐ | |

## Sign-off

| Check | Pass | Initials |
|-------|------|----------|
| Period open/close guards | ☐ | |
| GST export includes INV/CN | ☐ | |
| Unmatched queue match/clear | ☐ | |
| Edge journals (above) | ☐ | |
