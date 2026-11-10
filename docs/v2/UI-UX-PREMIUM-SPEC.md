# Hotel OS v2: World-Class UI/UX Specification & Blueprint

> **Benchmark References:**  
> - [Checkly — Hospitality Management Dashboard](https://dribbble.com/shots/27493983-Checkly-Hospitality-Management-Dashboard)  
> - [Lodgify — Hotel Management Dashboard](https://dribbble.com/shots/25585261-Lodgify-Hotel-Management-Dashboard-Figma-Template)  
> - [Hotel Booking SaaS Dashboard Design](https://dribbble.com/shots/27632268-Hotel-Booking-SaaS-Dashboard-Design-Hotel-Discovery)  
> - [List of Hotel Members Software](https://dribbble.com/shots/25350879-List-of-Hotel-Members-Software)  
> - [Hotel Booking Management Software Dashboard](https://dribbble.com/shots/25348510-Hotel-Booking-Management-Software-Dashboard)  
> - [Hotel management SaaS Branding UX/UI (Behance 257947863)](https://www.behance.net/gallery/257947863/Hotel-management-SaaS-Branding-UXUI-design)  
> - [Hotel Management System Dashboard UI (Behance 206680513)](https://www.behance.net/gallery/206680513/Hotel-Management-System-Dashboard-UI-Design)  
> - [Hotel Booking Management Dashboard (Behance 242826505)](https://www.behance.net/gallery/242826505/Hotel-Booking-Management-Dashboard-Design)

---

## 1. Executive Design Philosophy

The references represent the pinnacle of modern enterprise SaaS: **Clean, High-Density, Tactile, and Ultra-Luxury**.
Hotel OS v2 must adopt a **Neo-Spatial Obsidian & Liquid Ceramic** design language:

1. **Spatial Depth & Hairline Precision:** 
   - 1px hairline borders (`rgba(255, 255, 255, 0.08)` on dark, `rgba(15, 23, 42, 0.08)` on light).
   - Multi-radial ambient backdrops that give cards soft physical elevation rather than harsh flat borders.
   - Glassmorphic chrome for headers, drawers, and docks with solid opaque surfaces for data-dense room racks.
2. **High-Contrast Humanist Typography:**
   - Sharp hierarchy: Micro-eyebrows (`text-[10px] font-bold uppercase tracking-wider`), solid high-contrast numbers (`text-2xl font-black tabular-nums`), and semantic status chips.
3. **Information Density with Zero Clutter:**
   - Front desk operators process guest check-ins in under 10 seconds. Racks and worklists start immediately at the top row without tall empty hero cards eating vertical viewport.
4. **Delightful Tactile Physics:**
   - Framer Motion spring physics on button presses (`scale: 0.98`), morphing tab highlights (`layoutId`), and fluid drawer overlays.

---

## 2. Design System & Token Specifications

### Color Palette

| Token | Light Mode (Glacier Ceramic) | Dark Mode (Obsidian Void) | Semantic Role |
| :--- | :--- | :--- | :--- |
| `--hos-canvas` | `#F8FAFC` (Cool Slate) | `#070B12` (Deep Void) | Main app backdrop |
| `--hos-surface` | `rgba(255, 255, 255, 0.85)` | `rgba(17, 24, 39, 0.82)` | Glass header & sidebars |
| `--hos-cell` | `#FFFFFF` (Pure Crisp White) | `#111827` (Card Charcoal) | Solid data cells & cards |
| `--hos-primary` | `#2563EB` (Royal Blue) | `#3B82F6` (Electric Blue) | Primary accents & active states |
| `--hos-emerald` | `#10B981` (Vibrant Emerald) | `#34D399` (Bright Mint) | Occupied / Paid / Clean ready |
| `--hos-ruby` | `#EF4444` (Vibrant Rose) | `#F87171` (Pastel Coral) | Dirty / Due balance / OOO |
| `--hos-brass` | `#F59E0B` (Bhutanese Gold) | `#FBBF24` (Warm Amber) | VIP / Held bookings / Warning |
| `--hos-line` | `rgba(15, 23, 42, 0.08)` | `rgba(255, 255, 255, 0.08)`| 1px hairline dividers |

---

## 3. Screen-by-Screen UI/UX Upgrade Blueprints

### Blueprint 1: The Executive Shell & Navigation (`App.tsx`)

```
+------------------------------------------------------------------------------------------------------------------------+
| [◀] [P] Pelbu Suites ★★★★   [🔍 Jump to guest, room, voucher... ⌘K]   | 📅 08 Nov · Shift 1 | 🟢 Till: Nu. 48,250 | [⚡ Fast Book ⌘B] | 👤 Karma |
+------------------------------------------------------------------------------------------------------------------------+
| 🏨 Desk (Today)   [3] |                                                                                                |
| 📅 Reservations       |                                       MAIN CONTENT AREA                                        |
| 📊 StayView           |                                                                                                |
| 👥 Tour Groups        |                                                                                                |
| 🧹 Housekeeping   [2] |                                                                                                |
| 🍽️ POS & F&B          |                                                                                                |
| 💰 Finance            |                                                                                                |
| 👥 HR & Biometrics    |                                                                                                |
| ⚙️ Settings           |                                                                                                |
+------------------------------------------------------------------------------------------------------------------------+
```

1. **Brand Crest:** Pelbu Suites logo with golden 4-star rating badge and property indicator.
2. **Navigation Rail:**
   - Each item features an icon + label + real-time notification badge (e.g. `3` arrivals left on Desk, `2` dirty rooms on Housekeeping).
   - Fluid sliding pill background with Framer Motion `layoutId="activeNavPill"`.
3. **Executive Top Bar:**
   - **Center Search Input:** Sleek search pill displaying `⌘K` shortcut trigger.
   - **Business Date Chip:** Displays Bhutanese business date and active shift (`Nov 08 · Shift 1`).
   - **Live Till Indicator:** Floating chip with pulsing green dot showing active cash drawer balance (`Nu. 48,250.00`).
   - **Action Button:** High-contrast gradient button `⚡ Fast Book (⌘B)`.
   - **Profile Switcher:** Cashier avatar chip (`Karma Dorji`) with 1-tap PIN switch.

---

### Blueprint 2: Desk Mission Control (`DeskPage.tsx`)

```
+------------------------------------------------------------------------------------------------------------------------+
| Desk · Mission Control   ● 24 Rooms Active                             [ Wednesday, 08 Nov 2026 ]  [🖨️ Passes] [⚡ Fast Book ⌘B] |
+------------------------------------------------------------------------------------------------------------------------+
| [ 78% OCCUPANCY TONIGHT ] | [ NU. 142,500 REVPAR ] | [ 8 ARRIVALS TODAY ]  | [ 6 DEPARTURES TODAY ] | [ 19 CLEAN READY ]       |
| 18/24 Rooms · +12% vs yday| ADR Nu. 7,916 · 10% SC | 3 In-House · 5 En-Route| 4 Checked Out · 2 Pend | 3 In-Prog · 2 Dirty · 0OO|
+------------------------------------------------------------------------------------------------------------------------+
| FLOOR MAP QUICK STRIP (MINI ROOM MATRIX)                                                                               |
| F1: [101 🟢] [102 🔵] [103 🔵] [104 🟡] [105 🔵] [106 🟣]   F2: [201 🔵] [202 🟢] [203 🟢] ...  F3: [301 🔵] ...     |
+------------------------------------------------------------------------------------------------------------------------+
| LEFT PANE (65%): WORKLIST                                              | RIGHT PANE (35%): RADAR & OPERATIONS          |
| [Arrivals (8)] [In-House (14)] [Departures (6)] [Tomorrow (5)]          | +-------------------------------------------+ |
| 🔍 [Search guest, room, voucher...] [All] [VIP ★] [Groups 👥] [OTA]     | | 👑 VIP GUESTS IN RESIDENCE (3)            | |
|                                                                        | | Dr. Sarah Jenkins · Val-K (Mountain View) | |
| +--------------------------------------------------------------------+ | +-------------------------------------------+ |
| | [SJ] Dr. Sarah Jenkins ★ VIP      Rm 204 (DLX-K)     Nu. 0.00      | | | 👥 TOUR OPERATOR GROUPS IN HOUSE          | |
| |      PS-2026-1402 · 11-08 → 11-12 (4N) · MAP          Settled 🟢   | | | Yangphel Autumn Tour · 14 Pax · 7 Rms   | |
| |      [⚡ Check In & Keycard]  [Room Move]  [StayHub]               | | +-------------------------------------------+ |
| +--------------------------------------------------------------------+ | | 💵 ACTIVE CASHIER TILL & SHIFT AUDIT      | |
| | [TK] Tshering Karma               Rm 102 (DLX-T)     Nu. 12,450 Due| | | Nu. 48,250.00 · Float Nu. 20,000         | |
| |      PS-2026-1403 · 11-08 → 11-10 (2N) · CP           Pending 🔴   | | | [+ Cash Advance]  [- Cash Drop / Remit] | |
| |      [⚡ Check In & Keycard]  [Room Move]  [StayHub]               | | +-------------------------------------------+ |
+------------------------------------------------------------------------+-----------------------------------------------+
```

1. **Top Bento KPI Row (5 Metric Cards):**
   - **Occupancy Tonight:** Large bold `78%`, progress bar, room count `18/24`, delta tag.
   - **Daily Revenue / Yield:** `Nu. 142,500`, ADR `Nu. 7,916`, 10% SC included.
   - **Arrivals Flight:** `8 Arrivals`, breakdown `3 In-House · 5 En-Route`, unassigned warning.
   - **Departures Check:** `6 Departures`, `4 Checked-Out · 2 Pending Settlement`.
   - **Room Readiness:** HK status chips (`19 Clean Ready · 3 In-Progress · 2 Dirty · 0 OOO`).
2. **Floor Map Quick Strip:**
   - Miniature tactile room chips grouped by floor across the top.
   - Color coded: Green (Clean), Blue (Occupied), Amber (Dirty), Indigo (Arriving Today), Rose (OOO).
   - 1-tap opens the room's StayHub or HK inspection.
3. **Dual-Pane Operations Workstation:**
   - **Left (65%):** Worklist tabs with animated slider (`layoutId="deskTab"`), search input, VIP filter pill, and luxury guest cards with avatar, country tag, dates, meal plan, live folio balance chip, and 1-tap check-in buttons.
   - **Right (35%):** VIP arrivals radar with guest preferences, active tour group roster, cashier float tracker, and interactive shift checklist.

---

### Blueprint 3: Horizon StayView Tape Chart (`StayViewPage.tsx`)
1. **Zero-Waste Top Row Anchor:**
   - Tape chart starts immediately below the slim 38px toolbar.
   - Filters: Floor filter dropdown, Room Type dropdown, HK status dropdown, 7D/14D/30D pills, `📍 Jump to Today`.
2. **Daily Yield Occupancy Strip:**
   - Sticky header row calculating occupancy percentage and available room count for each date.
3. **Luxury Stay Ribbons:**
   - Pill ribbons with status coloring, guest name, tour group tag, and total net amount.
   - Drag-and-drop to move rooms or extend check-out dates.
   - Paint-to-book range selector: drag across 2–7 empty cells to trigger Fast Book with dates and room prefilled.

---

### Blueprint 4: FastBook Studio (`FastBookModal.tsx`)
1. **Obsidian Glass Modal Shell:**
   - Centered floating chassis with 1px specular border and backdrop blur.
   - Status ribbon: Dates, nights, room count, pax, meal plan, net total.
2. **Room & Pax Steppers:**
   - Rooms Count Stepper: `− 1 +` up to 8 rooms.
   - Adults Stepper: `− 2 +`.
   - Children Stepper: `− 0 +` with Bhutanese Child Policy rule badge.
   - Extra Bed Switch: Rollaway bed toggle with live `+ Nu. 1,500/night` calculation.
3. **Visual Room Category Grid:**
   - 2-column visual cards displaying room type code, name, live vacant inventory counter (e.g. `5 free`), and rack net rate.
4. **Meal Plan Matrix:**
   - Tactile cards for `EP`, `CP`, `MAP`, and `AP` with clear meal descriptions.
5. **DRC Form BST-3 Quotation Bento:**
   - Live real-time breakdown of Base Room Net, Meals & Extras, 10% Service Charge (SC Tip Pool), 10% Bhutan Sales Tax (BST), and Grand Total.

---

### Blueprint 5: StayHub Drawer (`StayHubDrawer.tsx`)
1. **Header:** Initials avatar with VIP badge, status pill, room number chip, and tour group badge.
2. **Dual-Folio Stream Toggles:**
   - Master (Tour Operator / Agency MoU) vs Personal (Guest Incidentals) streams.
   - Independent balances, folio line tables, and payment buttons.
3. **Night-by-Night Daily Rate & Meal Plan Matrix:**
   - Day-by-day table of stay dates (`N1 · 11-08`, `N2 · 11-09`, etc.).
   - Editable rate input, meal plan toggle buttons (`EP / CP / MAP / AP`), and extra bed switch for each night.
   - **"Copy N1 to all ↷"** button to bulk duplicate Night 1 across the stay.
4. **Room Move & Quick Addons:**
   - 1-tap room move target with reason selection.
   - Quick addon charges (Airport Shuttle, Hot Stone Bath, Laundry Bag).

---

## 4. Cursor Implementation Tasks

Execute these upgrades across the codebase:

1. **`v2/packages/ui/src/tokens.css`:**
   - Enhance the Obsidian Void and Glacier Ceramic token definitions with subtle specular highlights, ambient shadows, and refined border lines.
2. **`v2/apps/desk/src/shell/App.tsx`:**
   - Implement the Executive Top Bar with brand crest (*Pelbu Suites ★★★★*), global search pill `⌘K`, business date & shift tracker, live till indicator, and fast book gradient button.
   - Add icons (`MODULE_ICONS`) and dynamic notification badges to all sidebar items.
3. **`v2/apps/desk/src/modules/DeskPage.tsx`:**
   - Rebuild into the 5-card Bento KPI Row + Mini Room Matrix Strip + Dual-Pane (65% Worklist / 35% Radar) layout.
4. **`v2/apps/desk/src/modules/ReservationsPage.tsx`:**
   - Upgrade table with guest avatars, nationality flags, live balance tags, and row action buttons.
5. **Verification:**
   - Run `pnpm --filter @hos-v2/desk typecheck` (must pass with 0 errors).
   - Run `pnpm --filter @hos-v2/desk build` (production build must pass cleanly).
