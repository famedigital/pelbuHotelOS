# Cursor Brief: UI/UX World-Class Hospitality Overhaul

**Target:** Transform `v2/apps/desk` and `v2/packages/ui` into an award-winning, ultra-luxury hotel operations cockpit matching top-tier Dribbble and Behance hospitality benchmarks (*Checkly, Lodgify, Behance 206680513, Behance 257947863*).

---

## 1. Primary References & Visual Standards
- **Spec:** Read [`docs/v2/UI-UX-PREMIUM-SPEC.md`](../../docs/v2/UI-UX-PREMIUM-SPEC.md).
- **Core Aesthetic:** Neo-Spatial Liquid Titanium / Obsidian Void with 1px hairline specular borders, multi-radial backdrops, and high-contrast humanist typography.
- **Rules:** Follow `.cursor/rules/3d-glassmorphism.mdc` and `.cursor/rules/enterprise-core.mdc`.

---

## 2. Implementation Worklist

### File 1: `v2/apps/desk/src/shell/App.tsx` (The Executive Shell)
- **Brand Crest:** Pelbu Suites logo with golden 4-star rating badge and property indicator.
- **Top Command Bar:**
  - Center search input pill `🔍 Search reservation, guest, room (⌘K)`.
  - Bhutanese Business Date & Shift tracker `📅 Nov 08 · Shift 1`.
  - Floating Till balance chip with live pulsing dot `Nu. 48,250.00`.
  - Fast Book gradient button `⚡ Fast Book (⌘B)`.
  - Cashier avatar profile chip with quick PIN switcher.
- **Sidebar Rail:**
  - Add icons (`MODULE_ICONS`) to all 31 modules.
  - Add real-time counter badges: Arrivals left (`Desk`), Occupancy % (`StayView`), Dirty rooms (`Housekeeping`).
  - Active pill selection using Framer Motion `layoutId="activeNavPill"`.

### File 2: `v2/apps/desk/src/modules/DeskPage.tsx` (Desk Mission Control)
- **Top Bento KPI Row (5 Cards):**
  1. Occupancy Tonight: `78%`, progress bar, `18/24 Rooms`, delta pill `+12%`.
  2. Daily Yield: `Nu. 142,500`, ADR `Nu. 7,916`, 10% SC included.
  3. Arrivals Flight: `8 Arrivals`, `3 In-House · 5 En-Route`, unassigned room alert.
  4. Departures Check: `6 Departures`, `4 Checked-Out · 2 Pending Settlement`.
  5. Room Readiness: HK status chips (`19 Clean Ready · 3 In-Progress · 2 Dirty · 0 OOO`).
- **Mini Floor Map Quick Strip:**
  - Grouped by Floor 1, 2, 3 with tactile color-coded room chips (Green = Clean, Blue = Occupied, Amber = Dirty, Indigo = Arriving, Red = OOO).
- **Dual-Pane Workstation:**
  - Left (65%): Worklist tabs (Arrivals, In-House, Departures, Tomorrow) with search, VIP filter pill, and luxury guest cards with 1-tap `⚡ Check In & Keycard` and `Check Out`.
  - Right (35%): VIP guest radar with stay preferences, active tour group roster, cashier till summary, and shift checklist.

### File 3: `v2/apps/desk/src/modules/ReservationsPage.tsx` (Reservations Hub)
- Refined table with guest avatars, nationality flags, live folio balance chips, and 1-tap row action buttons.

---

## 3. Verification Commands
- `pnpm --filter @hos-v2/desk typecheck` (0 errors)
- `pnpm --filter @hos-v2/desk build` (clean production bundle)
