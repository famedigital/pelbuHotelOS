# INNORA (HOTEL OS v2) — ENTERPRISE PUBLIC HOMEPAGE SPECIFICATION
## The Sovereign Operating System for Himalayan Hospitality & Expeditions

> **Target App:** `v2/apps/web` (Next.js 15 App Router)  
> **Brand Identity:** Innora by Pelbu / Hotel OS Bhutan  
> **Aesthetic Standard:** Apple VisionOS Spatial Glass × Linear Command Density × Aman / Six Senses Himalayan Luxury  
> **Core Objective:** Build a commanding, authoritative, enterprise-grade public homepage that captures every real-world friction point faced by Hoteliers, Tour Guides, Fleet Drivers, Travel Agents, and International Guests—and proves how Innora unites them into an interconnected, zero-latency ecosystem.

---

## 1. The Core Narrative & Real-Life Problem Space

Conventional hotel software was built for static western chains with business travelers booking on Expedia. It completely fails the operational reality of Himalayan mountain hospitality, where **95% of guests arrive via Tour Operators, travel in coaster buses with licensed guides and drivers, navigate spotty mountain cellular coverage, and operate under strict Department of Tourism (DoT) and Department of Revenue & Customs (DRC) mandates.**

### The Real-Life Friction Innora Eliminates:

#### 1. The Reception Phone & WhatsApp Black Hole
* **The Reality:** The front desk landline rings non-stop while a receptionist tries to check in 14 arriving guests. Guides send urgent WhatsApp voice notes while driving through mountain valleys: *"Chef, we have 4 pure Jains and need 14 box breakfasts tomorrow at 6:00 AM for Tiger's Nest hike."*
* **The Breakdown:** The voice note gets buried in personal chats. The front desk forgets to tell the kitchen. The guide arrives at 6:00 AM with hungry guests, the dining room is dark, and the day's itinerary is ruined.

#### 2. Late Information on Guest Requests & Room Turnover Frantic Calls
* **The Reality:** A tour operator requests an extra rollaway bed and gluten-free meals 3 weeks prior on a PDF voucher. The voucher sits in an email inbox.
* **The Breakdown:** The guest arrives exhausted after an international flight to Paro and a mountain drive. The room has no extra bed. Reception frantically calls housekeepers over two-way radios or mobile phones while guests wait in the lobby for 45 minutes.

#### 3. Driver Neglect, Coaster Bus Parking, and Dorm Bed Chaos
* **The Reality:** A 22-seater Toyota Coaster bus arrives on narrow Thimphu / Paro roads. No parking space was reserved; private cars block the driveway.
* **The Breakdown:** The driver, exhausted after an 8-hour drive over Dochula Pass, has no assigned dorm bed. He has to wander into the hotel asking where to sleep, only to find the staff dorms are full, forcing him to sleep in a freezing bus. Meanwhile, he needs cash for diesel and vehicle wash, but the receptionist says: *"The GM has the safe key, wait until tomorrow."*

#### 4. The Travel Agent Allotment Blindspot & Billing Disputes
* **The Reality:** During peak Paro and Thimphu Tshechu festivals, agents send 25 frantic emails asking: *"Do you have 6 Deluxe rooms for October 12?"*. Hotels take 24–48 hours to reply; by then, Drukair flight seats are gone.
* **The Breakdown:** When the group departs, checkout is paralyzed by **Dual-Folio Confusion**: The agency pays room tariff and meals (Master Folio), but the guest bought wine, laundry, and spa treatments (Personal Folio). The front desk fails to collect the Nu. 4,500 personal bill before the bus leaves, and the hotel either loses the money or creates a toxic dispute with the agency.

#### 5. Bhutan DRC Form BST-3 & Police Immigration Panic
* **The Reality:** Every evening, front desk clerks manually type passport numbers, visa references, nationality codes, guide licenses, and bus registrations into spreadsheets for the Royal Bhutan Police (RBP) and Department of Immigration.
* **The Breakdown:** At the end of the month, accounting struggles to separate the 10% Bhutan Sales Tax from the 10% Service Charge tip pool, facing steep penalties from the Department of Revenue & Customs.

---

## 2. Page Architecture & Section-by-Section Blueprint

The public homepage in `v2/apps/web/src/app/page.tsx` must be structured into **7 high-impact, narrative-driven sections**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. FROSTED GLASS EXECUTIVE NAVBAR (Live Telemetry, Sovereign Crest)     │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. COMMANDING HERO SECTION (The Sovereign Operating System)              │
│    • Headline + Subhead + Dual CTAs                                     │
│    • Interactive Spatial Bento Cockpit Preview                          │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. THE BROKEN RELAY (Interactive Friction Matrix: Before vs After)      │
│    • Reception Phone Chaos · Kitchen Disconnect · Driver Dorm Bed       │
│    • Agent Email Blindspot · Dual-Folio Settlement Leakage              │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. THE 5-WAY SYNCHRONIZED ECOSYSTEM (Role-Based Micro-Workspaces)       │
│    [🏨 Hotelier Cockpit]  [🧭 Guide Companion]  [🚗 Fleet Driver Hub]   │
│             [💼 B2B Agent Portal]  [👑 Sovereign Guest]                 │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. THE BHUTAN FISCAL & REGULATORY ENGINE (Sovereign Invariants)         │
│    • DRC Form BST-3 Auto-Filing · 10% SC Tip Pool · ZKTeco Biometrics   │
│    • Royal Bhutan Police & Department of Immigration Manifests          │
├─────────────────────────────────────────────────────────────────────────┤
│ 6. INTERACTIVE OPERATIONS SANDBOX / ROI VALUE CALCULATOR                │
│    • Property room count slider · Hours saved · Eliminated leakage      │
├─────────────────────────────────────────────────────────────────────────┤
│ 7. AUTHORITY TESTIMONIALS & SOVEREIGN FOOTER                            │
│    • Industry leaders · Regulatory badges · Launch Desk CTA             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Specifications

### 1. Frosted Glass Executive Navbar
- **Height:** 56px floating pill container with `backdrop-blur-xl bg-slate-900/70 border border-white/10`.
- **Left:** Sovereign Gold Crown Crest (`👑`) + `Innora` logotype in `Plus Jakarta Sans` 900 Black + `Hotel OS v2` badge.
- **Center Links:** `The Ecosystem` (Dropdown with Guide, Driver, Desk, Agent), `The Broken Relay`, `Bhutan DRC Engine`, `Pricing & ROI`.
- **Right Array:**
  - Live Mountain Telemetry Chip: `✈️ PBH Flight Radar · Thimphu 14°C`.
  - Secondary Action: `Sign In (Staff PIN)`.
  - Primary CTA: High-contrast blue-to-indigo gradient spring button: `[Launch Cockpit 🚀]`.

---

### 2. The Commanding Hero Section
- **Headline (Display Typography):**
  > *"The Sovereign Operating System for Himalayan Hospitality."*
- **Sub-headline:**
  > *"Uniting Hotel Receptions, Tour Guides, Fleet Drivers, Travel Agents, and Kitchens into one real-time, zero-latency ecosystem. Built for the rugged operational realities of Bhutan."*
- **Call-to-Action Cluster:**
  - Primary: `[Experience Interactive Demo →]` (Opens live browser sandbox).
  - Secondary: `[Watch 2-Minute Ecosystem Film ▶]`.
- **Hero Graphic — The Living Spatial Ecosystem Bento:**
  A floating interactive 3D perspective chassis displaying real-time live data flowing between:
  1. *Guide Sangay* sending 14 Tiger's Nest breakfast box orders from his phone.
  2. *The Kitchen KDS* chiming with the order in under 20ms.
  3. *Driver Tashi* receiving his confirmed Dorm Bed B-02 and bus parking slot.
  4. *The Front Desk Cockpit* automatically encoding keycards for the 2:30 PM arrival.
  5. *Druk Asia Travel Agent* seeing room inventory drop by 7 rooms in real time.

---

### 3. "The Broken Relay" — Real-Life Friction Matrix
An interactive before-and-after bento grid showing the painful reality vs. Innora's synchronized truth:

#### Tile A: The Reception Phone & WhatsApp Black Hole
* **The Old Way (Pain):** *"Receptionist juggles 3 phone lines and 40 unread WhatsApp voice notes. 14 packed breakfasts for the Tiger's Nest hike were never communicated to the kitchen. Guests wait in an empty dining room at 6:00 AM."*
* **The Innora Way (Cure):** *"Guide taps 'Order 14 Box Breakfasts' on his mobile companion at 4:00 PM while hiking. The Kitchen KDS chimes immediately. Chef confirms. Boxes packed, tagged with dietary names, and waiting at 5:45 AM."*

#### Tile B: The Driver Dorm Bed & Coaster Bus Parking Scramble
* **The Old Way (Pain):** *"Exhausted bus driver arrives at 7:30 PM in freezing rain. Coaster bus blocks the driveway. Staff dorms are full; driver sleeps in the bus and is refused diesel cash until tomorrow."*
* **The Innora Way (Cure):** *"Toyota Coaster parking bay auto-reserved on booking. Driver Dorm Bed B-02 assigned with clean linen confirmed. 1-tap diesel cash advance issued directly from the Front Desk Till with automated receipt balance."*

#### Tile C: Late Information & The Frantic Housekeeping Radio
* **The Old Way (Pain):** *"Voucher requested a rollaway bed 3 weeks ago. Clerk forgets to check the email attachment. Guest walks into room 204 with no extra bed. Frantic radio calls to maids while guest complains in lobby."*
* **The Innora Way (Cure):** *"Voucher parsed on booking creation. Housekeeping Hallway Mode flags Room 204: 'Rollaway Bed Required + Welcome Cordyceps Tea'. Inspected and ready 3 hours prior to check-in."*

#### Tile D: The B2B Travel Agent Email Ping-Pong & Competitor Leakage
* **The Old Way (Pain):** *"Agents send 20 emails asking for rooms during Paro Tshechu festival. Hotel takes 24 hours to reply. Flight seats expire. Competing agents spot group names on physical front desk registers."*
* **The Innora Way (Cure):** *"24/7 B2B Partner Portal. Agents view live inventory with competitor masking ('Occupied · Tour Group'). 48-hour allotment holds placed in 10 seconds at contracted MoU rates."*

#### Tile E: Dual-Folio Incidentals Dispute
* **The Old Way (Pain):** *"Agency pays Master Folio. Guest leaves without paying Nu. 3,200 for wine and laundry. Hotel front desk clerk takes the blame or harasses the tour guide for repayment."*
* **The Innora Way (Cure):** *"Dual-Folio Settlement Gate: System strictly blocks guest checkout if Personal Balance > Nu. 0.50, even if the agency Master Folio has Nu. 200,000 credit pending. Zero revenue leakage."*

---

### 4. The 5-Way Synchronized Ecosystem (Interactive Product Tour)
Tabs allowing visitors to explore each dedicated role-based workspace:

1. **The Hotelier 100vh Mission Control (Desktop):**
   - Locked zero-scroll layout (46px header, 74px bento KPI ribbon, 38px floor strip, 65/35 dual-pane worklist).
   - Cashier Till vault with CFM vegetable market advance reconciliation.
   - Autonomous 1-click Night Audit engine that rolls the business date in 1.2s.
2. **The Tour Guide Companion (Mobile Priority #1):**
   - 1-tap group arrival pre-clearance with passport OCR scanning in transit.
   - Live dietary matrix (Pure Vegetarian, Jain, Gluten-Free, Allergies).
   - Expedition packed meal ordering directly to kitchen screens.
3. **The Fleet Driver & Dorm Hub (Mobile Priority #1):**
   - High-contrast outdoor display with assigned Dorm Bed (e.g. Bed B-02).
   - Dedicated bus parking spot allocation.
   - 1-tap diesel fuel and vehicle wash cash advances synced with front desk till.
4. **The B2B Tour Operator & Agent Portal (Web & Mobile):**
   - Real-time masked inventory calendar.
   - Contracted MoU rate calculations and instant 48-hour tentative holds.
   - Digital agency voucher upload and automated corporate master billing.
5. **The Sovereign Guest Experience:**
   - 8-second check-in with pre-encoded RFID keycards.
   - Personal stay preferences remembered across visits (*Quiet Top Floor, Buckwheat Pillow, Cordyceps Tea*).

---

### 5. Bhutanese Sovereign Fiscal & Regulatory Compliance
Highlighting Innora’s built-in regulatory engines:

* **Automated DRC Form BST-3 Tax Return:**
  - Separates Gross Room Sales, Exempt Tour Sales, Taxable Local Sales, 10% Bhutan Sales Tax (BST), and 10% Service Charge tip pool.
  - Printable official tax return with DRC barcodes.
* **10% Service Charge Staff Tip Pool Matrix:**
  - Automated points distribution (1.0 to 3.0 pts) prorated by biometric attendance days.
* **Biometric ZKTeco Push Terminal Integration:**
  - Direct HTTP ADMS `POST /iclock/cdata?table=ATTLOG` ingestion with shift tracking and late-minute calculation.
* **Daily Royal Bhutan Police & Department of Immigration Manifest:**
  - 1-click export of daily tourist manifest with passport, nationality, entry visa, guide license, and bus registration numbers.

---

### 6. Interactive ROI & Operations Value Simulator
An interactive slider widget for visiting hotel owners:
* **Inputs:**
  * Room Count Slider: `12 Rooms` to `80 Rooms`.
  * Average Occupancy: `30%` to `90%`.
  * Peak Festival Months: `2` to `6 Months`.
* **Dynamic Outputs Calculated Live:**
  * **Hours Saved Monthly on Front Desk Admin:** e.g. `142 Hours/month`.
  * **Eliminated Folio Incidentals Leakage:** e.g. `Nu. 38,400/month`.
  * **Average Check-In Speed:** Reduced from `12 minutes` to `8 seconds`.
  * **DRC Tax Filing Errors:** Reduced to `Zero`.

---

### 7. Authority Testimonials, Sovereign Proof & Footer
* **Testimonials:**
  - *"Before Innora, our guides spent 30 minutes in the lobby sorting out room keys while guests stood exhausted. Now, keys are pre-encoded and breakfast boxes are packed before we even step off the bus."* — **Senior Guide, Yangphel Adventure Travel**
  - *"As a hotelier in Paro, our biggest nightmare was the driver dorm beds and late dietary changes. Innora brought military precision to our property."* — **General Manager, Pelbu Suites**
* **Regulatory Badges:** Department of Revenue & Customs (DRC) Compliant, RMA Payment Gateway Verified, Department of Tourism (DoT) Star Standards Ready, Royal Bhutan Police (RBP) Manifest Auto-Exporter.
* **Final High-Impact CTA Banner:**
  > *"Replace the telephone chaos. Commission your sovereign hotel in 10 minutes."*
  - Dual CTAs: `[Launch Free Hotel Onboarding]` and `[Schedule Executive Walkthrough]`.

---

## 4. Visual & Technical Engineering Standards

- **Typography:**
  - Headings & Prose: `font-family: 'Plus Jakarta Sans', sans-serif`.
  - Figures, Currencies, Room #s, Dates: `font-family: 'JetBrains Mono', monospace`.
- **Color Palette & Glass Tokens:**
  - Canvas: Dark obsidian `#070b12` with subtle sapphire (`rgba(59, 130, 246, 0.14)`) and amber (`rgba(245, 158, 11, 0.08)`) ambient radial meshes.
  - Cards: `.hos-surface-glass` with 20px blur, `1px solid rgba(255, 255, 255, 0.12)`, and `inset 0 1px 0 rgba(255, 255, 255, 0.18)` specular rims.
  - Badges & Accents: Himalayan Brass (`#f59e0b`), Royal Sapphire (`#2563eb`), Sovereign Emerald (`#10b981`), Imperial Ruby (`#ef4444`).
- **Mobile First Priority (<768px):**
  - All cards stack cleanly into single-column vertical flows.
  - Touch targets strictly ≥ 48px.
  - Sticky bottom action bar with `[Book Demo]` and `[Explore Workspace]` buttons.
- **Zero Superficial Code:**
  - No lorem ipsum text.
  - All examples use authentic Bhutanese hotel, valley, and agency details (*Pelbu Suites, Thimphu, Paro, Yangphel, Druk Asia, Toyota Coaster BP-1-A2041, Nu. 6,500, DRC Form BST-3*).

---

## 5. Verification Commands
1. Run `cd v2 && pnpm --filter @hos-v2/web build` (Next.js production build must compile with 0 errors).
2. Verify responsive layout at 390px (iPhone), 768px (iPad portrait), 1024px (iPad landscape), and 1920px (Desktop).
