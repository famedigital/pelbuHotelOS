# Front Office system — constitution (2026–2029)

Hotel OS / Innora FO is a **trustworthy, guided, multi-tenant Front Office OS** — not an eZee feature-parity clone. This document is the checklist for any new FO money feature.

## Product thesis

- **One stay = one money truth**
- **Agent-native**, tax-honest, Bhutan/region independents and small chains
- AI may assist and explain; **never** silent post / void / pay

## Bounded contexts

| Context | Tables / modules | Owns |
|---------|------------------|------|
| Stay | `bookings`, `room_assignments`, `booking_guests` | Lifecycle, room, guests |
| Guest ledger | `folios`, `folio_lines`, `payments` | Journal + due |
| Fiscal | `fiscal_documents` | INV / RCP numbers; print = live lines |
| Collect-from party | `payment_mode` + `agent_id` | Guest cash vs agent AR |
| Locks | `booking_stay_leases`, `accounting_periods` | Concurrency + period override |

```mermaid
flowchart TB
  subgraph stay [Stay context]
    Booking[bookings]
    Assign[room_assignments]
  end
  subgraph ledger [Guest ledger]
    Folio[folios]
    Lines[folio_lines]
    Balance[guestLedgerBalance]
  end
  subgraph fiscal [Fiscal]
    Inv[fiscal_documents invoice]
  end
  Booking --> Folio
  Assign --> Booking
  Folio --> Lines
  Lines --> Balance
  Balance --> Inv
```

## Canonical money rules (non-negotiable)

1. **One balance API:** `guestLedgerBalance(lines)` = `netFolioBalance` in [`web/src/lib/folio/guest-ledger.ts`](../../web/src/lib/folio/guest-ledger.ts) / [`balance.ts`](../../web/src/lib/folio/balance.ts). StayHub, Open bills, Unpaid bills, calendar chip, settle bar — same function.
2. **Nightly base ≠ posted room line.** `agreed_nightly_rate_btn` = “Nightly base”; posted `source_type=room` = “Room charge (incl. tax/SC as configured)”.
3. **Collect-from party:** `deriveCollectParty({ paymentMode, agentId })` → `guest` | `agent`. Hide Agent bill CTAs when party = guest.
4. **Invoice** = pointer to folio + `doc_no`; print always live guest-visible lines. Empty after void-all → banner “repost then reopen INV”. No second INV without credit note.
5. **Void** = `voidFolioLineWithReversal`; due excludes void originals + their reversal credits. Period lock → structured error + auto-expand PIN + toast recipe.
6. **Stay lock** = soft lease (`booking_stay_leases`); money mutations require take-over or fail with toast naming who holds.
7. **Lifecycle stepper (honest):** Booked → Checked-in → Charges open → Invoice optional → Settled (balance≈0) → Checked-out. Never mark Settled/Paid while `|balance| > 0.5`.

## Sequence — check-in → collect → checkout

```mermaid
sequenceDiagram
  participant FO as Desk
  participant SH as StayHub
  participant L as guestLedgerBalance
  participant NA as Night audit
  FO->>SH: Check-in
  SH->>L: Day-1 room (+ meals if priced)
  NA->>L: postRoomNightsForDate (same poster)
  FO->>SH: Void wrong line
  Note over SH: Period PIN if locked
  FO->>SH: Preview + post missing nights
  FO->>SH: Issue INV (optional)
  FO->>SH: Collect until due Clear
  FO->>SH: Check-out
```

## Lock / period matrix

| Situation | Desk sees | Next action |
|-----------|-----------|-------------|
| Soft-closed / closed period on void/post | Toast: expand Period override | Manager PIN + short reason |
| Another desk holds stay lease | Amber banner with holder name | Take over (toast confirms) |
| Invoice after void-all | Print banner Nu 0 | Repost nights → reopen/reprint INV |
| Cash / pay-at-leave + agent on booking | Party: Guest | Collect payment (no Agent bill CTA) |

## StayView + Hub (desk IA)

Daily FO work lives on **two surfaces**. If a job needs a third page, attach it to Hub (sheet/drawer) or demote it to Advanced.

| Surface | Job | Route |
|---------|-----|-------|
| **StayView** | Living FO assistant — **Do / Report / Check** (ranked jobs, live refresh) | `/erp/stayview` (desk home; `/erp/today` redirects here) |
| **Hub** | One stay’s whole job — book → check-in → bill → invoice → collect → checkout | StayHub dialog (`?booking=&step=`) |
| POS | Food ticket + settle | `/erp/pos` |
| Night close | Night audit blockers | `/erp/night-audit` |
| Settings | Property + BYOK Gemini | `/erp/settings` |

**Primary nav (desk):** StayView · Hub (context) · POS · Night close · Settings.  
**Demote:** Open bills, City Ledger aliases, orphan invoice lists, rate islands → Advanced under Hub/Settings until unused.

**Language:** Guest words — Due, Collect, Bill, Invoice, Check in, Check out. Hide City Ledger / AR jargon from the daily path.

```mermaid
flowchart LR
  StayView["StayView today rack"] -->|"tap stay"| Hub["Hub one stay"]
  Hub -->|"done / next"| StayView
  Gemini["BYOK Gemini draft"] -->|"preview only"| Hub
  Hub -->|"human Confirm"| Ledger["guestLedgerBalance journal"]
```

### Allowed primary FO routes

| Job | Route |
|-----|-------|
| StayView (desk home) | `/erp/stayview` |
| Rack mode | `/erp/calendar` → Hub |
| Stay money (canonical) | Hub → Folio panel |
| Collect list | StayView unpaid + Hub Collect |
| Tax print | Hub Bill/Invoice → `/erp/invoices/[id]/print` |
| Night audit | `/erp/night-audit` |
| Training | `/erp/training#stayview-hub` |
| Advanced ledger | `/erp/folios/[id]` (deep-link money jobs → Hub `?step=stay_money`) |
| Advanced open bills | `/erp/folios` |
| Agent cockpit | `/erp/agents/[id]` Overview — Do / Report / Check; bookings open Hub |
| Agent Assist | Dossier BYOK: paste-to-stay + explain partner due (Confirm only) |

New FO features **must** attach to StayView or Hub (agent stays deep-link Hub from dossier). Agent money Collect → Hub `?booking=&step=` or Money tab / advanced folio — never silent AI writes.

## Balance call-site inventory (cutover)

Surfaces that **must** use `netFolioBalance` / `guestLedgerBalance`:

| Location | Status |
|----------|--------|
| `stay-hub.ts` summary + `fetchStayHubMoney` | ✅ `guestLedgerBalance` |
| `erp/folios/page.tsx` (Open bills) | ✅ `netFolioBalance` |
| `erp/folios/[id]/page.tsx` | ✅ `netFolioBalance` |
| `lib/erp/unpaid-bills.ts` | ✅ `netFolioBalance` |
| `erp/calendar/page.tsx` chip | ✅ `netFolioBalance` |
| `lib/folio/ledger-summary.ts` strip balance | ✅ via `guestVisibleBalanceLines` |
| `erp/invoices/[id]/print` | ✅ `guestVisibleBalanceLines` |
| `lib/folio/post-payment.ts` settle-zero | ✅ |
| `BookingBoardTable` list due | ✅ `netFolioBalance` |
| `lib/erp/day-ops-board.ts` | ✅ `netFolioBalance` |
| `erp-checkin.ts` balance readout | ✅ `guestLedgerBalance` |
| `lib/booking-detail.ts` | ⚠ not primary FO path |
| `lib/reports/fo-desk-reports.ts` | ⚠ report path — prefer helper |

New FO UI **must not** invent `sum(total_btn)` for guest due.

## StayHub Folio wireframe

```
[ Take over banner if locked ]
[ Due Nu X          ]  ← guestLedgerBalance only
[ Nightly base · Posted room · Party ]
[ Ledger — void behind Void disclosure ]
[ Primary CTA: Collect | Post missing nights | Reopen INV ]
[ Secondary: Open full folio ]
```

## BYOK Gemini — consent matrix

Property setting: `property_ai_settings` (encrypted `gemini_api_key_enc`, model, enabled).  
Platform env Gemini (finance receipt parsers) stays **separate** from desk BYOK.

| Job | Gemini does | Human confirms |
|-----|-------------|----------------|
| Paste agent WhatsApp / email | Extract guest, dates, room, meal, rate, guide | Create / update stay |
| Check-in | Fill nationality, pax, room suggestion, guide | Confirm check-in |
| Rate / agent sheet | Propose Agents-tier cells | Save sheet |
| Folio | “Why is due X?”, suggest void + repost nights | Void / post |
| Invoice FO | Draft notes, explain empty INV after void | Issue / print |
| Checkout | Checklist: due clear? guide? HK? | Confirm checkout |
| POS | Parse spoken/pasted order, suggest ticket lines | Add / settle |
| POS invoice/receipt | Draft share text / WA | Send |
| Night close | Summarize missing nights / blockers | Run audit |

**Hard blocks (no silent path):**

- No auto void / pay / post / delete / status change
- No auto “fix” folio balances
- No model write to `folio_lines` / `payments` / `fiscal_documents` without Confirm that calls existing server actions
- Audit every Confirm: `ai.draft_accepted` with prompt hash + actor

Implementation: [`web/src/lib/ai/gemini-byok.ts`](../../web/src/lib/ai/gemini-byok.ts), [`web/src/app/actions/erp-ai-assist.ts`](../../web/src/app/actions/erp-ai-assist.ts), UI `AiAssistPanel` (draft → Apply/Discard).

## AI rule (3 years)

Assist and explain (“why is due X?”). Human confirms every money write. Gemini may **read, suggest, draft, explain** — never post, void, pay, erase, convert, or issue INV/RCP without visible **Confirm** (and manager PIN when money/period rules already require it).

## Out of scope

POS KDS rewrite, HR, laundry, channel, CMS, new GST/RRCO pack, multi-invoice without credit-note product, silent AI money writes, eZee screen-count parity.
