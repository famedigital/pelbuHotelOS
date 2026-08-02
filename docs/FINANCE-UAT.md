# Finance UAT pack (Pelbu Olakha)

You are running the hotel without a separate accountant. Sign each check yourself after a real desk walk-through. Do **not** invent initials.

Run after Ops + Money waves. Desk property = Pelbu Suites Olakha.

## Owner month close (plain language)

Answer these before locking the period at `/erp/finance/setup`:

| Question | Where | Pass | Initials |
|----------|-------|------|----------|
| Can I see cash + bank + card clearing without Excel? | `/erp/finance` Hotel account vault | ☐ | |
| Is the unmatched bank queue empty (or explained)? | `/erp/finance/banking` | ☐ | |
| Are pending QR/NEFT proofs cleared? | `/erp/finance/bank-proofs` | ☐ | |
| Do I know who still owes (guests + agents)? | City ledger · AR vault KPIs | ☐ | |
| Can I file GST in BITS from the pack (A–E) without re-keying from paper? | `/erp/finance/gst` | ☐ | |
| Are payroll runs finalized and payslips paid (bank left hotel account)? | `/erp/hr/payroll` | ☐ | |
| Are vendor bills paid or left open on purpose in AP? | `/erp/finance/vendors` | ☐ | |
| Are there zero ledger posting errors? | Setup diagnostics | ☐ | |
| Did I tick the close checklist and lock the period? | `/erp/finance/setup` | ☐ | |

## Period close (technical)

1. Open `/erp/finance/setup` — confirm current month period is **open**.
2. Post one expense + one folio payment in the period.
3. Soft-close period (if UI present) — verify new posts require manager override.
4. Hard-close period — verify posts reject without override; override with reason + PIN audits.

## GST return export

1. Open `/erp/finance/gst`.
2. Export / view GST for the current month.
3. Confirm invoice `INV-YYYY-####` and any `CN-YYYY-####` credit notes appear.
4. Spot-check one folio: line GST totals match fiscal document.

## Bank recon unmatched queue

1. Open `/erp/finance` banking / unmatched section.
2. Import a statement (or use existing unmatched rows).
3. Auto-match where possible; leave at least one unmatched.
4. Manually match one unmatched txn to a payment or expense **or** use **Create payment/expense & match**.
5. Confirm unmatched queue shrinks and audit trail records the match.

## Edge journal proof (code)

Automated: `npm test` covers `proveEdgeJournals` for folio charge, payment, void reverse, comp, laundry, POS walk-in, payroll payout, agent AR.

Desk spot-check (initials required):

1. Post room charge → journal balanced under AR / room revenue.
2. Post payment → cash/bank vs AR.
3. Void a line → reverse journal.
4. Comp → expense vs AR.
5. Laundry via gateway → laundry revenue vs AR.
6. Walk-in POS cash (no folio) → cash + F&B revenue journal.
7. Mark payslip paid → payroll payable vs bank.
8. Agent bill-to room charge → AR agents (not guest AR).

| Edge path | Pass | Initials |
|-----------|------|----------|
| Folio charge journal | ☐ | |
| Folio payment journal | ☐ | |
| Void reverse journal | ☐ | |
| Comp journal | ☐ | |
| Laundry journal | ☐ | |
| POS walk-in cash journal | ☐ | |
| Payroll payout journal | ☐ | |
| Agent bill-to AR journal | ☐ | |

## Sign-off

| Check | Pass | Initials |
|-------|------|----------|
| Owner month close questions | ☐ | |
| Period open/close guards | ☐ | |
| GST export includes INV/CN | ☐ | |
| Unmatched queue match/create/clear | ☐ | |
| Edge journals (above) | ☐ | |

Related: [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) · [GST-EINVOICE.md](GST-EINVOICE.md) · [OPS-RUNBOOK.md](OPS-RUNBOOK.md) · [WHITEBOARD.md](WHITEBOARD.md).
