# FO hang-card — eZee → Pelbu

**Print this** · post at desk · one side, 1 page.  
**Switch catalogue (flows · folio · ~112 reports · gaps):** [ezee-bhutan-fo-switch-catalogue.md](../competitive/ezee-bhutan-fo-switch-catalogue.md)  
**Full map:** [ezee-absolute-full-map.md](../competitive/ezee-absolute-full-map.md)

---

## Muscle memory

| eZee | Pelbu click |
|------|-------------|
| Stay View | **Calendar** rack |
| Edit Transaction | **StayHub** (click stay / Arrivals / In-house) |
| Dashboard rates + actions | Fast Book quote + StayHub |
| Arrivals / Departures lists | **Arrivals** · **Departures** boards → StayHub |
| Folio Detail pay / void | StayHub → **Folio** (Bill · Collect · Advanced) |
| **Manage Folio** (Rate / Ext / Pay grid) | StayHub Folio → **Bill** — summary strip + ledger table (Room · Extra · Payment · Agent filters; void on row). Full folio page only when you need multi-account / transfer |
| Extra Charges / Payment Details | Same **Bill** ledger (filter chips), not separate windows |
| Cashiering Center (agent AR) | Folio Collect → **Charge agent AR** · Agent dossier |
| Night Audit | **Night audit** |
| Universal search | **Ctrl+K** (conf # · guest · phone · room · INV · agent) |
| Working date in status bar | Header **Biz date** chip (Thimphu open day) |
| Net Locks | Soft lock banner when another tab holds same stay |
| Checkout blocked on balance | StayHub Checkout → **Collect payment first** |

---

## Back Office (Absolute rail → Pelbu Money)

eZee’s **Back Office** icon is not a second PMS — in Pelbu flip the header **Back office** chip (or open Money / Agents). Settings stay footer (Configuration).

| Absolute Back Office | Pelbu click |
|----------------------|-------------|
| Pay Out / Paid Out Voucher | **Finance** → Money out / expenses (`/erp/finance`, Expenses) |
| Business Source | **Agents** (`/erp/agents`) |
| Cityledger A/C | Agent dossier AR · Payments · Folio **Charge agent AR** · City ledger |
| Undo Transaction | Folio void · Night audit voids |
| Misc. Sales | **POS** / walk-in folio |
| Insert Transaction | StayHub Folio post · Finance insert |

**Front desk** chip keeps Calendar · Arrivals · In-house · Departures · Reservations · Rooms/HK · Night audit (close day) · guest Payments/Folios.  
**Back office** chip keeps Finance · Invoices · Agents · Reports · GST · Inventory. POS in both.

Party Hub / Master Bill / Check-in = Front desk. Charge agent AR / AP pay-out = Back office.

---

## Three FO paths only

### 1. Local / walk-in (~90%)

Book rack or Fast Book → StayHub **Check-in** → stay  
**Pay at leave:** Folio → Collect (cash/QR/bank) → Checkout when clear  

### 2. Agent tour

Book with agent → Check-in (watch **open room cap**)  
Folio: guest cash + **agent AR**  
Checkout: **print pack → guide ink → photo/file → leave** → seal + email agent  

### 3. Morning arrivals

Arrivals board → StayHub Check-in · or rack right-click **Check-in**  

---

## Rack right-click (same idea as eZee)

Open stay · Check-in / Folio / Checkout · Booking page · Cancel / no-show (StayHub Details → More)

---

## Money rules (memorize)

1. **Due shows** left rail + Folio Due bar  
2. Checkout does not leave with guest bill open (unless manager override)  
3. Agent **room open cap** is the hard control — Nu credit is a **reminder** of AR outstanding (not a book block)  
4. Night audit owns **business date** — if CI blocked for future biz date, run NA or manager override  

---

## Support (our moat vs eZee 24×7)

Owner WhatsApp + [OPS-RUNBOOK](../OPS-RUNBOOK.md) · night audit pack · do not invent Nu without folio post  

---

## Timed UAT (beat the old habit)

| Path | Target |
|------|--------|
| Walk-in → name → CI → open Folio | &lt; 60s |
| In-house Collect remaining → Clear | &lt; 45s |
| Agent leave with pack photo | &lt; 3 min |

If Pelbu is slower on path 1–2, train — not switch software.
