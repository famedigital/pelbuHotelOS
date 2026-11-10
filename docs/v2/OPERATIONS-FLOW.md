# Hotel OS v2 — Operations flow (acceptance journeys)

> Canonical acceptance scenarios from Claude plan §5. Playwright E2E must cover these before cutover.
> Related: [MODULES.md](./MODULES.md) · [SOURCE-MAP.md](./SOURCE-MAP.md)
## 5. End-to-end journeys (acceptance scenarios)

1. **Agent group, Paro, 6 rooms, MAP**
   - Agent books in the portal → `held`. The desk confirms, so the rack shows 6 rows in the unassigned lane and the agent calendar turns them to "Mine".
   - The desk assigns rooms; the agent uploads passports and the guide → Compliance shows complete.
   - Check in all (Groups).
   - Night Audit posts room + MAP to the **agent folio** and SC+GST to the guest folio for extras.
   - Dinner drinks are charged to the room from the POS → **guest folio**.
   - Check out all:
     - guest folios paid → PSBN (guest)
     - agent folio → PSBN (agency) → Agents accounts receivable
     - rooms dirty → HK tasks
     - portal shows the invoice
     - agent uploads a payment proof → Agents verifies → ledger cleared live.
2. **Walk-in guest (FIT):** Fast Book → assign → check in (document scan) → Night Audit nights → laundry delivered → folio → checkout pays by mBoB → PSBN → room dirty → inspected → sellable on the rack and Channel.
3. **Restaurant walk-in:** POS table → fire → KDS bump → bill → settle cash → INV → stock depleted by recipe → shift close → cashier report.
4. **Cancellation:** agent requests a cancel → desk approves → booking cancelled → rooms released (rack + portal live) → policy fee posted to the agent folio → PSBN on the final bill → AR.
5. **Day close:** pre-audit checklist flags 1 unsettled POS bill and 2 dirty-but-vacant mismatches → fixed → audit runs → daily stats → Owner and Reports update → GST register ready in Compliance.
6. **Payroll:** a month of `sc.pooled` → HR distributes the tip pool by points → payroll.posted → Finance journal → payslips in the Staff Portal.

---


