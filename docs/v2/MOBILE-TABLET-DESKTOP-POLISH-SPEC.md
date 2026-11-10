# Hotel OS v2: Professional Density, Desktop Zero-Scroll & Mobile/Tablet Redesign (Level 0 to 100)

> **Mandate:** Transform Hotel OS v2 into an ultra-compact, professional workstation with zero whole-page scrolling on desktop screens, plus a complete 0-to-100 ground-up redesign for mobile and tablet devices.

---

## 1. Desktop Zero-Scroll Auto-Fit (100vh Cockpit)

### The Problem
Excessive padding, large empty cards, and tall 64px headers force front desk staff to scroll up and down constantly on 1080p and 1440p monitors.

### The Solution: 100vh Locked Frame
1. **Outer Shell (`v2/apps/desk/src/shell/App.tsx`):**
   - Root layout: `h-screen overflow-hidden grid grid-rows-[46px_1fr]`.
   - Header height: Locked to **46px** (razor-thin executive airline/terminal chrome).
   - Sidebar width: Locked to **210px** desktop default (or **60px** collapsed).
   - Sidebar padding: `p-2`, item padding `py-1 px-2.5 text-xs`.
   - Main content area: `h-full overflow-hidden flex flex-col p-3`.
2. **Desk Mission Control (`v2/apps/desk/src/modules/DeskPage.tsx`):**
   - Container: `h-full flex flex-col gap-2.5 overflow-hidden`.
   - Top Bento KPI row: `shrink-0 h-[74px]`.
   - Mini Floor Map strip: `shrink-0 h-[38px]`.
   - Workstation split (65% / 35%): `flex-1 min-h-0 grid grid-cols-12 gap-3 overflow-hidden`.
   - Left Stay List: `flex-1 overflow-y-auto pr-1 space-y-2` (smooth 4px custom scrollbar).
   - Right Operations Radar: `flex flex-col h-full overflow-y-auto space-y-2 pr-1`.
   - **Result:** Whole page NEVER scrolls. All primary controls, KPIs, search inputs, and tabs stay pinned on screen.

---

## 2. Mobile Redesign from Level 0 to 100 (<768px)

### 1. Hide Sidebar, Add Native Bottom Dock
- Desktop sidebar is completely hidden on mobile (`hidden md:flex`).
- Native fixed bottom dock (`fixed bottom-0 inset-x-0 h-16 bg-[var(--hos-surface)]/95 backdrop-blur-xl border-t border-[var(--hos-line)] z-50 flex items-center justify-around`):
  1. 🏨 **Desk** (`/desk`)
  2. 📊 **StayView** (`/stayview`)
  3. 🛏️ **Rooms** (`/housekeeping`)
  4. 🍽️ **POS** (`/pos`)
  5. ☰ **More** (opens full-screen slide-over sheet of all 31 modules).

### 2. Native iOS Bottom Sheet for FastBook & StayHub (`vaul`)
- On screens `<768px`, replace centered dialogs with a native bottom drawer using `vaul`:
  - Drag handle at top with swipe-to-dismiss gesture.
  - Large thumb-friendly stepper buttons (`+` and `−`).
  - Fixed full-width checkout button above virtual keyboard.

### 3. Mobile StayView: Day Carousel + Room Cards
- A 30-day horizontal table is unreadable on mobile.
- On mobile, `StayViewPage.tsx` renders:
  - **Swipeable Date Carousel:** `[Today 08] [Thu 09] [Fri 10] [Sat 11]...`
  - **Room Card List for Selected Date:** Large room cards showing occupant, clean status, and 1-tap assign/move.

### 4. Hallway Mode for Housekeeping (`HousekeepingPage.tsx`)
- Room attendants walking through corridors with phones:
  - Large tactile cards for each room with giant switches: `[Mark Clean]`, `[Mark Dirty]`, `[Inspect]`.
  - Camera upload for maintenance / room damage photos.

---

## 3. Tablet Redesign (768px to 1024px)

1. **Auto-Collapsed Icon Rail (60px):**
   - Defaults to an icon-only 60px rail with tooltip flyouts.
2. **Touch-Optimized Targets:**
   - Minimum 44px touch targets on buttons and table rows.
3. **Adaptive 2x2 Bento Grid:**
   - Top KPI ribbon automatically reformats into a 2-column responsive grid.
4. **Adaptive Workstation Stack:**
   - Left worklist takes 60% and right operations radar takes 40%.

---

## 4. Implementation Checklist for Cursor

1. Update `v2/apps/desk/src/shell/App.tsx` with locked `46px` header, `210px` sidebar, and Mobile Bottom Dock.
2. Update `v2/apps/desk/src/modules/DeskPage.tsx` with `100vh` zero-scroll flex-1 container and internal scrolling list.
3. Add responsive mobile drawers and date carousel in `FastBookModal.tsx` and `StayViewPage.tsx`.
4. Verify with `pnpm --filter @hos-v2/desk typecheck` and `pnpm --filter @hos-v2/desk build`.
