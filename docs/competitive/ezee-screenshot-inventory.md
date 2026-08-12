# eZee FrontDesk — screenshot inventory + Pelbu parity

**Date:** 2026-08-11  
**Corpus:** 58 files in [`Eze Screens/`](../../Eze%20Screens/) (property *Seven Suites*, eZee FrontDesk 7.x FO walkthrough 2026-08-06 + 2026-08-11)  
**Companion:** [ezee-absolute-full-map.md](ezee-absolute-full-map.md) · hang-card [fo-ezee-to-pelbu-hang-card.md](../ops/fo-ezee-to-pelbu-hang-card.md) · machine CSV [ezee-controls.csv](ezee-controls.csv)

**Method:** Every file in the corpus was opened. Controls are **deduped by UI surface** (same Print cascade shot six ways = one matrix block). Pelbu status uses [FEATURES.md](../FEATURES.md) + live routes under `web/src/app/erp/`.

**Coverage (this corpus)**

| Metric | Value |
|--------|------:|
| Screenshots registered | 58/58 |
| Control CSV rows | 217 |
| Report **names** from tree | ~112 |
| Report **param forms** captured | 8 |
| Report **sample prints** captured | 3 |
| Export formats captured | 7 (+ Set Default) |
| Status: Partial / Missing / Parity | 119 / 65 / 26 |
| Priority P0 rows | 34 |

---

## 1. Screenshot register (all 58)

| File | Module | Surface | Notes |
|------|--------|---------|-------|
| `2026-08-06 143439` | Reports | Direct Billing Aging Report filter | Full FO sidebar + BO/Audit tree + aging params |
| `2026-08-11 183543` | Walk In | Wizard step 1 Info | Rate, nights, A/C/I, tax exempt, incl/excl tax |
| `183551` | Walk In | Wizard step 2 Select Room | Filters + room grid |
| `183557` | Walk In | Wizard step 3 Business Source | Source list, commission, meal-rate matrix |
| `183617` | Reservation | Wizard step 1 Info | + Release days/% |
| `183622` | Reservation | Wizard step 2 Select Room | Same room filters as walk-in |
| `183636` | FO | Reservation List | Status radio Active·Cancelled·Noshow·Void·All |
| `183648` | Group/Book | Book Room Wizard step 1 | Confirm Booking, group color, arrival time |
| `183653` | Group/Book | Book Room step 2 Source | + vacancy-by-type table |
| `183703` | Group/Book | Book Room step 3 General Info | Booked-by, guest address, remark |
| `183716` | Group/Book | Book Room step 4 Rooms | Type inventory + overbook col + qty |
| `183725` | FO | Booking List | Short list view |
| `183742` | FO | Guest Ledger | Filters + multi IDs |
| `183800` | FO | Guest Ledger Option menu | Print / Export |
| `183814` | FO | Ledger row context | Open Transaction · Group · Settlement · Extra · Folio |
| `183836` | Folio | Folio multi-row list | Rate/Ext/Discount/Pay/Adj/Balance |
| `183843` | Folio | Print menu L1 | Master/Folio/Reg/Settlement/Extra |
| `183900` | Folio | Print L2 Master Summary | Preview · Print · Foreign Currency |
| `183908` | Folio | Print L2 Master Details + FC | Currency `$` |
| `183916` | Folio | Print L2 Folio Details + FC | same |
| `183923` | Folio | Print L2 Registration Card + FC | same |
| `183948` | FO | Arrival List | Filters + calendar |
| `184015` | FO | Arrival context menu | Change Stay · Move · Cancel · Noshow… |
| `184022` | Res ET | General Information tab | Full stay money + source + audit footer |
| `184027` | Res ET | Room Sharing / logistics pane | Visa + pickup/drop + vehicle + multi guest |
| `184031` | Res ET | Other Information tab | DNR, prefs, house use, web res, transport |
| `184035` | Res ET | Rate Information tab | Day grid + tax + apply scope |
| `184039` | Res ET | Extra Charges tab | Posted extras + packages + inclusion |
| `184043` | Res ET | Payment Details tab | Payment grid + Encash/Refund/Void |
| `184052` | Res ET | Print (voucher tree) | Preview/Print/Email voucher · attachments · FC · Reg |
| `184056` | Res ET | More menu | Change Stay, settle, move, wakeup, audit, guide… |
| `184104` | Print sample | Registration Card (Seven Suites) | Guest stay + ID fields |
| `184125` | FO | Departure List | Empty day; same filter chrome as Arrival |
| `184138` | FO | Guest Profile List | Advanced search accordion |
| `184203` | Nav | Back Office + Guest Messages empty | Rail icons + BO menu + messages grid header |
| `184210` | Back Office | Pay Out (AP) form | Entry fields |
| `184221` | Back Office | Pay Out (AP) form | (duplicate shoot) |
| `184229` | Back Office | Insert Transaction Wizard step 1 | Same as walk-in info shell |
| `184247` | Back Office | Business Source list | 327 companies |
| `184255` | Tools | Account List + Tools menu | Reminder, Net Lock, L&F, Wakeup… |
| `184321` | Tools | Lost and Found dialog | Found / Lost tabs + filters |
| `184454` | System | Kebab menu | Settings… Live Support |
| `184504` | System | Full app chrome + reports placeholder | Working / Audited / Shift dates |
| `184513` | Reports | Tree: Reservation + Group + FO start | Report names |
| `184526` | Reports | Tree: Room / Marketing / Direct Billing | Report names |
| `184536` | Reports | Tree: Night Audit + Back Office start | Report names |
| `184543` | Reports | Tree: Back Office rest + Audit and Void | Report names |
| `184606` | Reports | Reservation List **params** | Full filter form |
| `184618` | Reports | Arrival List Report **params** | + remark type |
| `184622` | Reports | Booking List **params** | Void/Cancel/Noshow toggles |
| `184627` | Reports | Cancellation Report **params** | |
| `184631` | Reports | Deposit Due Report **params** | |
| `184635` | Reports | Monthly Availability Chart **params** | Month/Year only |
| `184638` | Reports | Monthly Room Inventory **params** | |
| `184645` | Reports | Reservation List params (dup/crop) | |
| `184731` | Reports | Export format menu | RTF→Excel Data Only |
| `184744` | Reports | Reservation List **sample print** | Active reservations table |
| `184912` | Reports | Yearly Occupancy Report **sample** | Room type × month |

---

## 2. Front Office navigation (sidebar)

| Control | Type | Pelbu | Route / notes | Priority |
|---------|------|-------|---------------|----------|
| Walk In | nav | Partial | DeskBook / rack walk-in CI — not 3-step wizard | P2 |
| Reservation | nav | Parity | `/erp/reservations?new=1` DeskBook | P2 |
| Reservation List | nav | Partial | `/erp/reservations` (filters weaker, no void radio legend) | **P0** |
| New Booking | nav | Partial | Party board / multi-room DeskBook | P1 |
| Booking List | nav | Partial | Overlaps reservations; no separate booking# list | P2 |
| Out of Order | nav | Parity | `/erp/rooms` + calendar OOO/OOS/hold | P2 |
| Guest Ledger | nav | Partial | `/erp/in-house` + StayHub Folio; multi-# filter thinner | P1 |
| Arrival List | nav | Parity+ | `/erp/arrivals` → StayHub | — |
| Departure List | nav | Parity+ | `/erp/departures` → StayHub | — |
| Guest Database | nav | Partial | `/erp/guests` (+ history); birthday/anniv advanced search Missing | P1 |
| Guest Message | nav | Missing | No room message inbox | P2 |
| Global Search (CTRL+SPACE) | chrome | Parity | Ctrl+K | — |
| Live Support | chrome | Behind_by_design | Ops WhatsApp / docs — not embedded chat | Defer |
| Working / Audited / Shift date bar | chrome | Partial | Biz date + night audit; no separate Shift Date | P1 |

**Icon rail (visible):** Front Office · Back Office/Reports · Tools · Housekeeping · Maintenance  
**Pelbu:** grouped sidebar (FO, F&B, Finance, HR, …) — different IA, same jobs mostly.

---

## 3. Create wizards — control matrix

### 3.1 Shared step 1 (Walk In / Reservation / Insert Transaction)

| Control | Type | eZee detail | Pelbu | Priority |
|---------|------|-------------|-------|----------|
| Rate Type | dropdown | RACK RATE, meal plans | Partial — tiers/meal plans DeskBook | P1 |
| Rate lookup (calendar icon) | action | inventory/rate peek | Partial — remaining inventory rail | P1 |
| Arrival date | date | Res wizard | Parity | — |
| Departure date | date | | Parity | — |
| Nights | stepper | | Parity | — |
| Adults | stepper | | Parity | — |
| Children | stepper | | Partial — child packages | P1 |
| Infants | stepper | | Partial — free-under years, UI thin | P1 |
| Tax Exempt · Bhutan Sale Tax | checkbox | per tax | Missing at book | **P0** |
| Tax Exempt · GST(5%) | checkbox | | Missing at book | **P0** |
| Tax Exempt · Service / Service Charge(10%) | checkbox | | Missing at book | **P0** |
| Rate Inclusive Tax | radio | | Missing FO toggle | **P0** |
| Rate Exclusive Tax | radio | default | property default only | **P0** |
| Comp. Rate | checkbox | | Partial — folio comp | P1 |
| Rate manual | money | | Partial — agreed nightly PIN | P1 |
| Currency / calculator icons | action | | Missing FO | P2 |
| Override Rate for whole stay | checkbox | | Partial — stay-level override | P1 |
| Release · days of Arrival | checkbox+N | res only | Missing | **P0** |
| Release Amount % | money | res only | Missing | **P0** |
| Scan Credit Card / Identity | button | walk-in source step | Missing hardware | Defer |
| Back / Next / Finish / Cancel | buttons | | N/A UX | — |

### 3.2 Select Room (Walk In / Reservation)

| Control | Type | Pelbu | Priority |
|---------|------|-------|----------|
| Room Type filter | dropdown | Partial | P1 |
| Room Name | text | Partial preferred unit | P1 |
| Show Clean Rooms only | checkbox | Missing pick-list | **P0** |
| Room Amenity | dropdown | Missing FO filter | P1 |
| Room Owner | dropdown | NA condo | Defer |
| Search / Refresh | actions | | — |
| Grid: Room Type, Name, Alias, Type Alias | cols | Partial map units | P2 |
| Inventory count by date (source step) | table | Partial remaining inventory | P1 |

### 3.3 Business Source (Walk In / Booking)

| Control | Type | Pelbu | Priority |
|---------|------|-------|----------|
| Market Place | dropdown | Partial origin/source | P1 |
| Business Source list | listbox | Partial `/erp/agents` | P1 |
| Add / search source icons | actions | Partial agents | P1 |
| Commission plan | dropdown | Partial agent rates; **no plan pick on book** | **P0** |
| Commission value | field | Missing FO | P1 |
| Sub Source | dropdown | Missing | P1 |
| Voucher No | field | Partial agent voucher concepts | P1 |
| Apply Source Rate | checkbox | Partial agent tier rates | P1 |
| Connect Room | checkbox | Missing | P2 |
| Rate matrix CP/EP/MAP/AP/RACK/COMP + extra adult/child + weekend * | grid | Partial meal packages; table UI Missing | **P0** |

### 3.4 Book Room wizard extras (group)

| Control | Type | Pelbu | Priority |
|---------|------|-------|----------|
| Confirm Booking | checkbox | Partial held→confirmed | P1 |
| Group Color | color | Partial group tint | P2 |
| Arrival time | checkbox+time | Partial | P1 |
| Book & Close / Book & Continue | buttons | Partial | P2 |
| Booked (booker) lookup | field | Missing | P1 |
| Salutation / Last / First / Address / City / State / Zip / Country / Email / Phone / Fax | fields | Partial guest | P1 |
| Copy to guest information | checkbox | Missing | P1 |
| Remark | textarea | Parity notes | — |
| Room types: Total / Available / Over Booking / No. of Rooms qty | grid | Partial multi-qty; **overbook col Missing** (guard only) | P1 |

---

## 4. List screens

### 4.1 Reservation List

| Control | Type | Pelbu | Priority |
|---------|------|-------|----------|
| Status: Active / Cancelled / No Show / Void / All | radio | Partial status query; no Void legend strip | **P0** |
| Legend Void red / Noshow orange / Cancelled blue / Active green | legend | Missing | **P0** |
| Cols: Res.No, Room, First, Last, Res.Date, Arrival, Departure, Source, Voucher No | grid | Partial | **P0** |
| New / Edit / Void / Close | footer | Partial StayHub | **P0** |
| Row select multi | checkbox | Partial party board | P1 |

### 4.2 Booking List

| Control | Type | Pelbu | Priority |
|---------|------|-------|----------|
| Cols Booking No, Booked For, Booked date, First, Last, Source, Phone | grid | Missing separate booking# entity | P2 |

### 4.3 Guest Ledger / Arrival / Departure (shared filter chrome)

| Control | Type | Pelbu | Priority |
|---------|------|-------|----------|
| From / To Date | date | Partial boards = today-focused | P1 |
| Guest Name | text | Parity search | — |
| Document No | dropdown | Partial PS/INV search | P1 |
| Market Place / Source | dropdown | Partial | P1 |
| Looking For (In House / Guest to Check In / Check Out) | dropdown | Parity separate boards | — |
| City Ledger | dropdown | Partial agent AR | P1 |
| Room Type / Room | dropdown | Partial | P1 |
| Master Folio | checkbox | Partial Advanced folio | P1 |
| Include Room Sharer | checkbox | Missing | P1 |
| Meal Plan button | action | Partial StayHub meal | P1 |
| Revenue Break Down | action | Partial package rail / reports | P1 |
| Option · Print / Export | menu | Partial CSV export | P1 |
| Multi IDs: Booking / Reservation / Folio / Registration / Bill / Confirmation / Web # | cols | Partial PS + INV; reg/bill/web thinner | P1 |

### 4.4 List context menus

**Ledger (in-house):** Open Transaction · Open Group · Settlement · Post Extra Charge · Manage Folio  

**Arrival:** + Change Stay · Room Move · Mark as Cancel · Mark as Noshow  

| Item | Pelbu | Priority |
|------|-------|----------|
| Open Transaction | StayHub | — |
| Open Group | Party / StayHub | P1 |
| Change Stay | Calendar edit / StayHub | P1 |
| Room Move | Rack move + undo | Parity |
| Settlement | StayHub Collect | — |
| Post Extra Charge | Folio extras | Parity |
| Manage Folio | StayHub Folio | — |
| Mark Cancel / Noshow | Lifecycle CI | Parity |
| Row-level money without opening hub | Missing density | **P0** |

---

## 5. Reservation Edit Transaction (6 tabs) — full controls

### 5.1 Tabs

General Information · Room Sharing · Other Information · Rate Information · Extra Charges · Payment Details  

**Pelbu mapping:** StayHub steps Details / Check-in / Folio / Checkout (recomposition, not clone).

### 5.2 General Information

| Control | Pelbu | Priority |
|---------|-------|----------|
| Last/First guest + lookup + add | Partial guests | P1 |
| Settlement: Cash / Credit / Partial Credit | Partial guest vs agent AR | **P0** |
| Settlement Type, Card No, Exp, Bill To | Partial | P1 |
| Folio No + refresh | Partial folio id | P1 |
| Arrival/Departure datetime | Partial dates primary | P1 |
| Adult/Child/Infant | Partial | P1 |
| Tax Exempt row | Missing | **P0** |
| Season / Rate Type | Partial | P1 |
| Market Place / Source / Commission | Partial | P1 |
| Reservation # / Voucher # | Partial PS + notes | P1 |
| Release info | Missing | **P0** |
| Rate summary rail (charges, tax, balance) | Parity StayHub Due | — |
| Guest remarks tabs: Guest / Reservation / CI / CO | Partial notes | P1 |
| Flags: Generate Bill No, Show Rate on Reg, Folio for Sharer, Stop Room Move, Override Rate | Partial | P1 |
| Next Reservation warning | Missing StayHub banner | P1 |
| Footer: More · Print · Check In · Update · Close | Partial | P1 |
| Booked By / Reserved By / CI By / CO By | Weak audit UI | P1 |

### 5.3 Room Sharing / logistics (shot 184027)

| Control | Pelbu | Priority |
|---------|-------|----------|
| Multi-guest grid Last/First | Partial party not per-room sharer | **P0** |
| Visa: Serial, Visa No, Date, Issue Place, Arrived From, Date/Time in country, Purpose, Going To, Depart transport | Partial CI passport/SDF | P1 |
| Arrival/Departure Mode, Name, No, Station, DateTime | Missing transport block | P1 |
| Pick Up / Drop Off checkboxes + time | Missing | P1 |
| Vehicle Company/Model/Year/Color/Plate/State | Missing | P2 |
| Pax Check In / Out | Partial | P1 |
| Visa Form button | Missing | P1 |
| Copy Address | Missing | P2 |

### 5.4 Other Information

| Control | Pelbu | Priority |
|---------|-------|----------|
| Transport arrival/departure (dup) | Missing | P1 |
| DNR reason | Missing blacklist UI | P1 |
| Guest Preferences list (room/floor/type) | Missing | P1 |
| Web Reservation Affiliate Name/Code | Missing soft | P2 |
| House Use + remark | Missing flag | P1 |
| Allow Integration Posting | channel partial | Defer |

### 5.5 Rate Information

| Control | Pelbu | Priority |
|---------|-------|----------|
| Per-date Rate Type, Rate, Discount, Taxable | Missing day grid | **P0** |
| Tax lines Bhutan / Service / GST amounts | folio nights partial | **P0** |
| Net Rate | Partial | P1 |
| Apply to selected / checked / full stay | Missing | **P0** |
| Change only pax info | Missing | P1 |
| Split Bulk Rent / Merge Bulk Rent | Missing | P1 |
| Apply Discount / Apply Changes | Partial adj | P1 |
| Day grid columns Date, Day, Room, Rate Type, Rate, Disc, taxes, Total, Season, Adult, Child | Missing | **P0** |

### 5.6 Extra Charges

| Control | Pelbu | Priority |
|---------|-------|----------|
| Show Voided / Show Close Folio | Partial void audit | P1 |
| Grid Date, Folio, Charge Type, Voucher, Remark, User, Amount, Tax, Adj, Total | Partial | P1 |
| Print / New / Edit / Void | Partial | P1 |
| Special Packages Add/Remove | Partial meal packages | P1 |
| Inclusion Name / Posting Type | Missing | P1 |

### 5.7 Payment Details

| Control | Pelbu | Priority |
|---------|-------|----------|
| Grid Date, Folio, Pay Type, Card#, Exp, Auth, Receipt, Amount, User, Cur Amt, Sign | Partial Collect | P1 |
| Encash · Print · Refund · New · Edit · Void | Partial | P1 |
| Show Close Folio | Partial | P2 |

### 5.8 More menu (184056)

| Item | State | Pelbu | Priority |
|------|-------|-------|----------|
| Change Stay | enabled | Partial | P1 |
| Add Settlement | enabled | Parity Collect | — |
| Add Extra Charge | enabled | Parity | — |
| Room Move | enabled | Parity | — |
| Follow Up | enabled | Missing | P2 |
| Add Wakeup Call | enabled | Missing | P2 |
| Audit Trail | enabled | Partial audit_events; no FO popover | P1 |
| Card | enabled | Partial reg | P1 |
| Guest Note | enabled | Partial | P1 |
| Assign Guide | enabled | Partial leave evidence not assign | P1 |
| Exchange Room | disabled | — | — |
| Automatic Folio Routing | disabled | Missing product | P1 |
| Undo Check Out | disabled | Missing | P1 |
| Undo CheckIn | disabled when paid else | Parity undo CI rules | — |

### 5.9 Print from ET (184052)

| Item | Pelbu | Priority |
|------|-------|----------|
| Preview Voucher | Partial docs | P1 |
| Print Voucher | Partial | P1 |
| Email Voucher | Partial Resend packs | P1 |
| Email Other Attachments | Missing | P2 |
| Foreign Currency submenu | Missing | P2 |
| Registration Card Preview/Print/FC | Partial print + photo | P1 |

### 5.10 Folio list print tree (183843–183923)

| Document | Preview | Print | FC ($) | Pelbu | Priority |
|----------|---------|-------|--------|-------|----------|
| Master Folio Summary | • | • | • | Partial statement | **P0** |
| Master Folio Details | • | • | • | Partial | **P0** |
| Folio Summary | • | • | • | Partial bill | **P0** |
| Folio Details | • | • | • | Partial | **P0** |
| Registration Card | • | • | • | Partial | P1 |
| Settlement Details | — | • | | Partial settlement pack | P1 |
| Extra Charge Details | — | • | | Missing dedicated | P1 |

Folio summary cols (183836): Folio · Guest · Rate · Ext Charge · Discount · Payment · Adjustment · Balance · Language · Discount · New · Edit · Delete — Pelbu StayHub Due + Advanced Partial.

---

## 6. Guest Profile List

| Control | Pelbu | Priority |
|---------|-------|----------|
| Quick: Last, First, ID Number, Phone | Partial | P1 |
| In House Guest Only | Partial | P1 |
| Advance Search accordion: Gender, Marital, Birth date, Anniversary, Spouse Birth | Missing | P1 |
| Address / Identification / Contact / Misc search groups | Missing deep | P2 |
| Result: Guest Type, Name, Country, Source, Email, City, Phone | Partial | P1 |
| New / Edit / Delete | Partial | P1 |

---

## 7. Back Office (as shown)

| Control | Pelbu | Priority |
|---------|-------|----------|
| Pay Out (AP) full form: Voucher, Paid To, Reg No, Category, Extra Charge, Room, Outlet, Remark, Amt, Disc%, Tax, Qty, Adj, line Add/Void/Cancel, Total Paid, Print/Save | Partial finance expenses | P1 |
| Paid Out Voucher (nav only) | Partial | P2 |
| Misc. Sales (nav) | Missing/POS | P2 |
| Insert Transaction wizard | Overlap desk book | P2 |
| Undo Transaction (nav) | Partial night audit / voids | P1 |
| Business Source list 327 rows + Plan + Plan Value | Partial agents | P1 |
| Cityledger A/C (nav) | Partial agent dossier AR | P1 |
| Guest Message list Room/First/Last/From | Missing | P2 |

---

## 8. Tools & utilities

| Control | Pelbu | Priority |
|---------|-------|----------|
| Reminder | Missing | P2 |
| Network Lock | Soft multi-tab lock Partial | P1 |
| Phone Directory | Missing | Defer |
| Lost & Found Found/Lost tabs + filters + CRUD | `/erp/lost-found` Parity | — |
| User Messages | Missing | P2 |
| Wakeup Call | Missing | P2 |
| Transport Mode/Name/Station (greyed) | Missing master | P2 |
| Account List (city ledger names) | Partial agents | P1 |

**Lost & Found fields:** Item Name, Color, Where Found, Room, Found range, Returned By, Discarded By, Returned/Discarded status+date; cols ID, Entry Date/Time, Item, Where, Color, Room, Return, Discard — Pelbu has simpler board.

---

## 9. System kebab menu

| Item | Pelbu | Priority |
|------|-------|----------|
| Settings | `/erp/settings` | — |
| Refresh Language | NA | Defer |
| Blank Reg. Form | Partial blank reg print | P2 |
| Database Backup / Restore | Ops not in product | Defer |
| Night Audit | `/erp/night-audit` | — |
| Undo Night Audit | Missing | P1 |
| Product Tour / FAQ / Live Support / Feedback / License / Contact / About | Defer / ops | Defer |

---

## 10. Formats matrix

### 10.1 Report export (184731)

| Format | Pelbu | Priority |
|--------|-------|----------|
| Rich Text | Missing | P2 |
| Word | Missing | P2 |
| Excel | Partial CSV | P1 |
| PDF | Partial print packs | P1 |
| HTML | Missing | P2 |
| Excel (Data Only) | Partial CSV | P1 |
| Set Default Export | Missing | P2 |

### 10.2 Print languages

- Folio Language dropdown (Default English) — Pelbu print docs Settings Partial  
- Foreign Currency print switch `$` — Missing Nu multi-currency print Defer for Olakha

---

## 11. Report catalogue (names from tree)

**Legend:** `params` = filter form in corpus · `sample` = printed sample · Pelbu = closest route or Missing

### 11.1 Reservation (8)

| Report | Corpus | Pelbu |
|--------|--------|-------|
| Arrival List Report | params + partial list | `/erp/arrivals` Partial report |
| Booking List | params | Missing dedicated |
| Cancellation Report | params | Missing |
| Deposit Due Report | params | Missing → **P0** |
| Monthly Availability Chart | params only | `/erp/calendar` Partial |
| Monthly Room Inventory | params | Partial calendar occ |
| Reservation List | params + sample | `/erp/reservations` Partial export |
| Reservation List (FCC) | name only | Missing |

### 11.2 Group/Booking (8)

Assigned Room Report · Group Arrival List · Group In-house Report · Group Outstanding Report · Group Reservation List · Monthly Group Arrival List · Monthly Group Revenue · Unassigned Room Report  

Pelbu: party board / rooming Partial · all formal reports Missing

### 11.3 Front Office (22+ seen)

Arrival Departure List · Arrival, Departure & Stay Over · Arrival/Departure Stay Over(FCC) · Complimentary Room Report · Daily Arrival and Revenue Forecast By Business Source · Daily Pax Analysis Report · Daily Reservation by Source - Summary · Departure List · Early Check in / Late Check out Report · Early Departure · Front Office Occupancy (Bhutan) · Group Rooming Status · Guest Actual Checked Out Status · Guest Checked In · Guest Checked Out · Guest Checked Out Detail · Guest Checked Out List · Guest Checked Out List(Grand Chandira) · Guest In House · Guest Ledger · Guest Pick up/Drop off Report · House Use · Meal Count Report · Meal Plan… (truncated cut)  

Pelbu: boards + meal on stay Partial · formal meal/pickup/forecast reports Missing

### 11.4 Room Report (5+)

Block Room Report · No of Room Nights · Ownerwise Room Report · Room History Report · Room Statistics Report · (also) Monthly Meal Plan Costing · Rate Plan Bifurcation · Room Status Report  

Pelbu: rooms / night audit Partial

### 11.5 Marketing and Analysis (20)

Bedwise Occupancy · Contribution Analysis (+FCC) · Guest Contribution · Monthly Country wise Pax · Monthly Guest Analysis Detail · Monthly Guest Forecast · Monthly Room Type wise Occupancy · Monthly Sales Count · Monthly Statistics · Monthly Summary Business Sourcewise · Production Analysis (+FCC) · Reservation by Country · Revenue Forecast · Room Revenue Operational · RoomAndBedwise Occ · Roomwise Occ · Sales By Hotel Representative · Vehicle / News Paper List · Yearly Occupancy (**sample**) · Yearly Roomwise Occ  

Pelbu: `/erp/reports/performance` + marketing ROI lite Partial · most Missing

### 11.6 Direct Billing and Company (6)

Business Source Commission · CGVR Rate Card · Direct Billing Aging (**params**) · Direct Billing Register · Direct Billing Report Detail · Summary  

Pelbu: agent production / AR Partial · aging slabs Missing

### 11.7 Night Audit (23)

Allowance Detail · Call Detail · Daily Flash · Daily Receipt · Daily Receipt Pay Type Detail · User Wise Detail · User Wise Summary · Daily Refund · Daily Room Rate · Daily Settlement · Daily Summary Breakdown · Daily Summary · Discount Detail · Extra Charge · Night Audit Report · POS to PMS · Room Rate Variation · Room Revenue By Rate Type · By Room Type Detail · Summary · Settlement Detail · User Shift · User Shift [Mackinnon]  

Pelbu: `/erp/night-audit` printable pack Partial · depth Missing

### 11.8 Back Office (23)

Advance Deposit Ledger · City Ledger · Currency Report · Daily Accommodation Break Up (Summit) · Daily Payable Voucher · Daily Receivable Voucher · Daily Revenue Breakdown · Daily Revenue Summary · Daily Sales · Daily Transaction · Folio Listing · Guest Outstanding · Guest Registration Listing · Monthly Extra Charge Tax · Monthly Tax · M-Pesa Transaction · Owner Statement · Owners Account Statement · Payable Receivable Mapping Log · Sales Bill Register · Sales Bill Report GCC · Sales Register · Tax Exemption Report  

Pelbu: `/erp/finance` + GST Partial · M-Pesa NA · owner condo NA

### 11.9 Audit and Void (16)

Audit Trail Booking · Change Stay · Extra Charges · Payments · Room Rate · Insert Transaction Report · Night Audit Log · Room Move Report · Snapshot Validation · User Activity Log · Void Guest FollowUp Reason · Void Report Booking · Extra Charges · Guest Check In · Payment · Reservation  

Pelbu: `audit_events` Partial · void reports Missing

**Report count named in tree ≈ 112** · with params ≈ 8 · with sample print = 3 (Res List, Yearly Occ, Reg Card)

**Pelbu report catalog today** (`web/src/lib/reports/catalog.ts`): agent-production · agent-ar · staff-attendance · staff-sales · inventory-movements · + owner performance · manager flash — **≪** eZee breadth.

---

## 12. Sample print layouts captured

### Registration Card (`184104`)
Logo · REGISTRATION CARD · Reg Card No · Arrival/Dept date·time · Room type · # rooms · # guests · Room # · Full Name · Address · Passport · DOB · Country · Nationality · Visa No · Visa Validity · Email · Tel · Company · signature box  
Pelbu: Settings Documents Registration + signed photo Partial

### Reservation List print (`184744`)
Property · Printed By/Date · Page · filter criteria · cols: Rsrv No, Rsrv Date, Source, Guest, Arrival, Departure, Pax A/C, Nights, Room No, Type, Rate Type, Total Amt, Amt Paid, User  
Pelbu: no matching printable multi-filter res list — Missing **P0**

### Yearly Occupancy (`184912`)
Room type × Jan–Dec nights · Total Nights · Occupancy % · yearly 22.84% sample  
Pelbu: performance/occ Partial not identical

---

## 13. Coverage scorecard

**From CSV** (`ezee-controls.csv`: **217 data rows** + header):

| `pelbu_status` | Count |
|----------------|------:|
| Partial | 119 |
| Missing | 65 |
| Parity | 26 |
| Behind_by_design | 4 |
| NA | 3 |

| `priority` | Count |
|------------|------:|
| P1 | 116 |
| **P0** | **34** |
| P2 | 33 |
| — (done/parity daily path) | 24 |
| Defer | 10 |

| Metric | Value |
|--------|------:|
| Screenshots registered | 58/58 |
| Unique surfaces harvested | 34+ |
| Control CSV rows | 217 |
| Report names (tree) | ~112 |
| Report param forms in corpus | 8 |
| Report/doc sample prints | 3 |
| Corpus control coverage (visible UI) | ≥95% |
| Full Absolute FO product (needs capture) | ~45–55% until §15 shots land |

---

## 14. Re-ranked product backlog (from counts)

### P0 — desk / reservations office (ship order)

| # | Item | Status (2026-08-11 code) |
|---|------|--------------------------|
| 1–8 | Res list · night grid · tax/release · print pack · clean pick · export · commission partial | **Done / Partial #7** |

Live roll-up: [docs/plans/ezee-fo-parity-status.md](../plans/ezee-fo-parity-status.md) — **product phases closed**.

### P1 — FO jobs (closed 2026-08-11)

| Item | Status |
|------|--------|
| Logistics · visa · DNR · house use · audit · next-res | **Done** |
| Deposit-due · cancel · meal count · FO occ · room move · guest AR aging | **Done** |
| Multi-guest names (StayHub) · guest CRM filters | **Done** |
| Settlement Collect/AR | Partial pre-existing |
| Auto-release cron · multi-format Word/RTF | **Defer** |

### P2 practical

| Item | Status |
|------|--------|
| Wake-up · follow-up · guest message (inhouse tasks + StayHub) | **Done** |
| Guest Message center · phone book · Live Support · FC · M-Pesa | **Defer** |

### Do not clone

3-step walk-in wizard shells with stock art · 100-report checklist as v1 · eZee chrome.

**Pelbu ahead (keep):** StayHub density · guide/driver comps · agent open-room cap · PS vs INV IDs · realtime rack · POS→folio serve/void · modern PWA.

---

## 15. Operator capture checklist (missing modules)

Folder target: `Eze Screens/capture/`

### A Stay View / Quick / Dashboard
- [ ] Full Stay View Gantt + legend + toolbar  
- [ ] Right-click empty cell full menu  
- [ ] Right-click stay bar full menu  
- [ ] Quick View metrics  
- [ ] Dashboard rates+actions  

### B Incomplete list depth
- [ ] Reservation List Cancelled / Noshow / Void / All with data rows  
- [ ] Out of Order create + list  
- [ ] Guest Message with ≥1 row + compose form  
- [ ] Guest Ledger Checked Out looking-for  

### C Edit Transaction dialogs
- [ ] Room Sharing filled + Generate Folio for Sharer  
- [ ] Split reservation / Split folio / New folio  
- [ ] Room Move + Change Stay dialogs  
- [ ] Cancel fee + Noshow fee posting  
- [ ] Wakeup / Follow Up / Audit Trail filled  
- [ ] Assign Guide complete  
- [ ] Auto Folio Routing enabled path  

### D Group
- [ ] Group list · in-house bulk CI · bill-to owner · unassigned rooms  

### E Cashiering
- [ ] Cashiering Center balances + pay  
- [ ] Company / TA account deep  
- [ ] Paid Out Voucher list · Undo Transaction full  

### F Night audit body
- [ ] Each NA step · Undo NA confirm · Daily Flash print  

### G Config consoles
- [ ] Room/rate/tax masters · CI/CO/cancel/noshow fees · mandatory fields · roles · doc templates  

### H Critical report samples (params + one PDF/Excel each)
- [ ] Deposit Due output  
- [ ] Cancellation sample  
- [ ] Meal Count · Pickup/Drop · Early CI/Late CO  
- [ ] FO Occupancy (Bhutan)  
- [ ] Direct Billing Aging result  
- [ ] City Ledger · Audit Trail Booking · Void Reservation  
- [ ] Monthly Availability grid R/B/I  
- [ ] Monthly Inventory table  

### I Formats prove
- [ ] One report exported Excel · PDF · HTML  
- [ ] Folio print FC with Nu if available  

---

## 16. File map

| Artifact | Path |
|----------|------|
| This inventory | `docs/competitive/ezee-screenshot-inventory.md` |
| Control CSV | `docs/competitive/ezee-controls.csv` |
| Product map | `docs/competitive/ezee-absolute-full-map.md` §9 |
| Screens | `Eze Screens/` |

**Re-ingest:** drop new shots in `Eze Screens/capture/` and append matrix rows; recompute §14 priorities if Missing counts shift.
