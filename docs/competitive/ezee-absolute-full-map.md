# eZee Absolute — full product map (external scan)

**Date:** 2026-08-10  
**Purpose:** Competitive intelligence vs Pelbu desk ERP. Sources are external only (manuals, brochure, Freshdesk, reviews). Not a clone checklist — FO **jobs** to match and **Bhutan wedge** to win.  
**Brand:** eZee Absolute under **Yanolja Cloud Solution (YCS)** / eZee Technosys (Surat). Host lineage: `live.ipms247.com` FO + Config logins.

Companion: [FO hang-card](../ops/fo-ezee-to-pelbu-hang-card.md) · [FO agent commerce checklist](../FO-AGENT-COMMERCE-CHECKLIST.md)

---

## 1. Product suite

| Product | Role |
|---------|------|
| **eZee Absolute** | Cloud PMS — FO, folio, HK, night audit, agent/company AR |
| **eZee FrontDesk** | On-prem PMS (same FO mental model) |
| **eZee Centrix** | Channel manager (~130+ OTAs) |
| **eZee Reservation** | Direct booking engine |
| **eZee Optimus** | Restaurant POS → guest folio |
| **eZee Panorama** | Hotel website builder |
| **eZee Mint** | Revenue management |
| **eZee Critique** | Review management (add-on) |
| **Mobile app** | Alerts, HK, multi-property, print docs |

**Packaging (example small property, public reviews):** Classic ≈ PMS only · Elite = PMS + booking engine · Star = PMS + channel · Champion = all three. Add-ons: POS, Mint, seats, locks.

---

## 2. Two consoles

| Console | Who | Job |
|---------|-----|-----|
| **Configuration** | Owner / manager | Rooms, rates, taxes, masters, users, CI/cancel rules |
| **Front Office** | Desk / night auditor | Every guest-day operation |

**FO status bar always shows:** property · user · **working (business) date** · system date · version · Live Support.  
Business date advances only via **Night Audit**.

---

## 3. Configuration console (master data)

### Rooms

Amenities · Room Type (base/max pax, colour, web inventory, **Paymaster** dummy) · Bed Type · Room (phone ext, key-card alias, connecting, smoke) · Sort · Status colours · **Room Owner** (condo commission)

### Rates

Rate Type · Season · Room Rates (**Regular / Seasonal / Business Source**) · Taxes (flat / % / slab) · Sort rates

### Housekeeping config

Housekeepers · Units (public areas) · Status names + colours

### Master lists

Currency (FX applies **after** next NA) · Pay methods (surcharge) · Extra charges · Identity types · Reasons · Discounts (per-user grants) · Transport · Payouts · Email templates · Blacklist reasons · Market codes · Res types · Preferences · VIP · **Business sources**

### Settings

Hotel info · ADR/Occ/RevPAR formulae · Notices on docs · Document sequences · Print/email templates · **CI/CO times, day-use %, late-CO %, cancel fee, no-show fee**, mandatory fields · Display defaults (bill-to, cash vs credit) · Tax account map · Payment gateway · User roles + privileges

---

## 4. Front Office surface

### Three views

1. **Stay View** — room × date Gantt; drag empty cell → walk-in/res; right-click ops  
2. **Quick View** — Occ / ADR / RevPAR / pax / inventory / HK counts  
3. **Dashboard** — availability **+ rate chart** + in-house shortcuts (staff favourite)

### Top modules

**Front Office:** Walk-in · New Reservation · Reservation List · Arrivals · Departures · Guest DB · Night Audit · Net Locks · Password  

**Group:** Group res · In-house · Departed · bulk CI / bill-to owner  

**Cashiering:** Travel Agent DB · Company DB · Expense voucher (AP) · **Cashiering Center** (city ledger AR)  

**HK:** House status · OOO blocks · Work orders  

**POS (Absolute):** Incidental AR (Optimus for full F&B)  

**Reports:** Res / FO / back office / audit voids / stats / graphs (100+ claimed)

### Edit Transaction (their StayHub)

| Tab | Jobs |
|-----|------|
| General | Bill-to, cash/credit, sharers, inclusions, messages/tasks/prefs, balance |
| Room Charges | Per-night rate / pax / discount |
| Folio Detail | Pay · extra · adjust · transfer · city ledger · void · move · tax exempt · **split folio** · new folio · bill-to |

**Shortcuts:** Room Move · Amend Stay · Message/Task/Preference · HK · Split · Void · Checkout (due out only, **balance must be 0**)

### Night Audit

Classic 5 steps: pending res → release no-shows → room status / CO → post nightly charges → create new day.  
Enhanced: Auto NA, Front Desk Operations (open folios + missed CI/CO), bulk CI + auto assign.

### Net Locks

Concurrent desks: one clerk owns ET for a room; others blocked until unlock.

---

## 5. Guest lifecycle

```
Inquiry/channel → Hold/confirm → Pre-arrival assign → CI (business date) →
In-house (move/amend/POS) → Night audit posts room → Settle (cash/company/agent AR) →
Checkout (balance 0) → HK dirty
```

Cancel / no-show → optional fee → settle or city ledger.

---

## 6. FO jobs staff train on (videos / KB)

Add reservation · Group booking · Group CI/CO · Room move · Split reservation · Manual charges · Comp · Unsettle folio · Undo CI · Night audit · Folio split room vs extras · Cancel with fee · Unassign/reassign · User roles

---

## 7. Market SWOT (independent reviews)

**Strengths:** Cheap all-in-one PMS+CM+BE · reliable OTA sync · POS→folio · multilingual · 24×7 support  

**Weaknesses:** Dated dense UI · shallow analytics · weak native WhatsApp · BE branding limits  

**Attack surface for boutique Bhutan:** Tour guide paper culture · SDF/docs · guide/driver comps · room-cap AR · modern single-stay hub (Pelbu StayHub) · real-time desk UX

---

## 8. Sources

| Source | Use |
|--------|-----|
| [FO Help PDF](https://www.yanoljacloudsolution.com/resources/eZeeAbsolute_FrontOffice_Help.pdf) | FO IA, ET, NA, reports |
| [Config Help PDF](https://www.yanoljacloudsolution.com/resources/eZeeAbsolute_Configuration_Help.pdf) | Masters + CI/tax rules |
| [Brochure](https://www.ezeeabsolute.com/Absolute_Brochure.pdf) | Marketing + suite stats |
| [Enhanced Night Audit](https://release.ezeetechnosys.com/enhanced-night-audit-flow/) | Auto NA |
| yanoljacloudsolution.freshdesk.com | How-tos |
| HotelSystemsGuide eZee review 2025 | UX SWOT |
| ExploreTECH Absolute | Feature checklist |
| ezeeabsolute.com/videos.php | Training topics |

---

## 9. Win front desk (product order)

**Screenshot evidence (2026-08-11):** full control inventory of property FrontDesk capture (58 files) → [ezee-screenshot-inventory.md](ezee-screenshot-inventory.md) + [ezee-controls.csv](ezee-controls.csv). **217** control rows (Partial 119 · Missing 65 · Parity 26); **~112** report names; **34 P0** items. Corpus ≥95% of visible UI in shots. Full Absolute FO still needs Stay View / NA body / Cashiering / Config / Group deep captures (checklist in inventory §15).

0. **Dense StayHub** — largely shipped (left identity + Due, compact DeskSettle, sticky footer). Residual only if UAT red at 1366×768.  
1. **Reservations office FO (P0 from inventory counts)**  
   - Res list density: Active / Cancelled / Noshow / void language + color legend + row actions (StayHub · move · settle · cancel · noshow)  
   - Per-night **Rate Information** grid (tax lines, discount, apply full-stay)  
   - Book-time **tax inclusive/exclusive + per-tax exempt**  
   - **Release days/%** + **Deposit Due** worklist/report  
   - Stay **Print pack** tree (master/folio summary·detail, reg, settlement, extras)  
   - Clean-only unit pick · agent commission/source rate matrix at book · printable res list + CSV/Excel  
2. **FO-parity jobs (residual)** — rack context · omnisearch · **business date** · soft concurrent stay lock · zero-balance CO · day-use/late CO fees · cancel/no-show **fee** paths · Undo NA  
3. **Money depth** — multi-folio / master attach · company bill-to · agent AR settlement UX · auto folio routing  
4. **Bhutan kill-shot (already ahead; keep)** — guide pack + photo · agent open-room cap · soft pay-at-end for locals · guide/driver comps  

**Do not** clone 3-step wizards, chase Centrix/Mint/Critique/600 integrations, or aim for 100 named Absolute reports on Day-1 boutique.
