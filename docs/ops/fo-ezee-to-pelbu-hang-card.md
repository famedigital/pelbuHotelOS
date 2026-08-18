# FO hang-card — recommended process

**Print this** · post at desk · one side, 1 page.  
**Switch catalogue:** [ezee-bhutan-fo-switch-catalogue.md](../competitive/ezee-bhutan-fo-switch-catalogue.md)

Pelbu **recommends the next job** from hotel truth (biz date, stay, folio, HK). Do not hunt the menu. Money always needs a human tap.

---

## Daily process (follow the button)

1. **Today** — ranked worklist. One row, one button.
2. Button opens **Edit Transaction** (StayHub) on the recommended step — or **Housekeeping** for vacant Dirty.
3. After **Checkout** → room Dirty → **Send to HK**. Vacant Clean shows on Stay View for Walk In.
4. Empty Today → **Stay View** → empty cell = Walk In.
5. Stale working date → **Night Audit** banner (not a tab to remember).

| Rank | If this is true | Button |
|------|-----------------|--------|
| 1 | Arrival today, not checked in | Check-in |
| 2 | In-house, due, departing today | Collect |
| 3 | In-house, balance ~0, departing today | Checkout |
| 4 | Vacant Dirty (blocks Walk In) | Housekeeping |
| 5 | Hold / deposit due | Confirm |

---

## Rail (four destinations)

**Today · Stay View · Housekeeping · POS**

**More:** Arrival List · Guest Ledger · Departure List · Reservation List · City Ledger · Night Audit · Guests.

Ctrl+K still finds everything (Loyalty, Finance, Sales claims stay off the FO rail).

---

## eZee aliases (switchers)

| eZee | Pelbu |
|------|--------|
| Stay View | **Stay View** (`/erp/calendar`) |
| Edit Transaction | **Edit Transaction** overlay (StayHub) |
| Arrival List | More → Arrival List |
| Guest In House / Ledger | More → Guest Ledger |
| Departure List | More → Departure List |
| Reservation List | More → Reservation List |
| Folio / Room Bill | Edit Transaction → **Folio · Collect**. Tax **INV-** under More / Print pack. Confirmation is **PS-…** (not an invoice). |
| City Ledger | More → City Ledger · Collect → Charge agent AR |
| Night Audit | Banner when stale · More → Night Audit |
| Housekeeping Dirty/Clean | Stay View Dirty pip + HK chip on Edit Transaction |
| Walk In | Empty cell on Stay View (or empty Today → Stay View) |
| Universal search | **Ctrl+K** (guest · PS- · INV- · room · agent) |

Do not clone eZee’s 3-step wizard or 112 reports. Pelbu named prints stay the 14 FO reports.

---

## Edit Transaction (one process)

Title: guest · **PS-…** · room · **HK chip**.  
Work pane = recommended step. Footer = **one** CTA (Check-in / Collect / Checkout / Send to HK).  
Print, Invoice `INV-`, Advanced split, undo → **More**.

After Checkout the next recommended job is Housekeeping for that room.

---

## Money rules

1. Due shows on the stay — Collect before Checkout.
2. **PS-…** = stay confirmation. **INV-…** = GST tax invoice from Folio.
3. Agent **room open cap** is the hard control; Nu AR is a reminder.
4. Night Audit owns the working date.

---

## Back office (other hat)

Header **Back office** chip: Pay Out → Finance/expenses · Business Source → Agents · Cityledger → City Ledger / agent AR · Misc Sales → POS · Undo → Folio / NA void.

---

## Intelligence (no chatbot on the desk)

Today and Edit Transaction use **hotel state**, not an LLM. Do **not** put Cursor or Claude in desk runtime.

Optional later: Gemini copilot (existing `GEMINI_API_KEY` + AI SDK) may **explain** a lock or **fill notes** from a CID photo. It must never check-in, collect, invoice, or Night Audit by itself.

---

## Timed UAT

| Path | Target |
|------|--------|
| Empty Today → Stay View Walk In | &lt; 60s |
| Arrival row Check-in lands CI | one tap |
| Due-out Collect → Checkout → Dirty on Today | one stay |
| Clerk never opens Loyalty / Finance to finish a stay | pass |
