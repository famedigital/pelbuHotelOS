# Cursor Brief: Professional Density, Zero-Scroll Desktop & 0-to-100 Mobile/Tablet Overhaul

**Target:** Refactor Hotel OS v2 (`v2/apps/desk` and `v2/packages/ui`) to achieve ultra-compact professional density with zero page-level scrolling on desktop (100vh lock), plus a complete level 0-to-100 redesign for mobile and tablet devices.

---

## 1. Specification & Standards
- **Spec:** Read [`docs/v2/MOBILE-TABLET-DESKTOP-POLISH-SPEC.md`](../../docs/v2/MOBILE-TABLET-DESKTOP-POLISH-SPEC.md).
- **Core Aesthetic:** Airline / Trading Terminal precision with compact padding, 100vh locked viewport, and native touch mobile flows.

---

## 2. Implementation Tasks

### Task 1: Desktop Zero-Scroll Auto-Fit (`v2/apps/desk/src/shell/App.tsx`)
- Lock app frame: `h-screen overflow-hidden grid grid-rows-[46px_1fr]`.
- Top header: Locked to `46px` height, tight padding (`px-3 py-1.5`).
- Sidebar: Width `210px` (collapsed: `60px`), tight padding (`p-2`, items `py-1 px-2 text-xs`).
- Main outlet: `h-full overflow-hidden flex flex-col p-3`.
- No outer page scrolling allowed on desktop!

### Task 2: Mobile Bottom Dock & App Bar (`<768px`)
- In `App.tsx`, hide desktop sidebar on mobile (`hidden md:flex`).
- Add sticky Mobile Bottom Navigation Dock (`fixed bottom-0 inset-x-0 h-16 bg-[var(--hos-surface)]/95 backdrop-blur-xl border-t border-[var(--hos-line)] z-50`):
  - 🏨 **Desk** (`/desk`)
  - 📊 **StayView** (`/stayview`)
  - 🛏️ **Rooms** (`/housekeeping`)
  - 🍽️ **POS** (`/pos`)
  - ☰ **More** (opens full-screen slide-over sheet for all 31 modules).
- Mobile Top Bar (height `46px`): Compact brand avatar, Till balance chip, and Quick Search button.

### Task 3: Desk Today Workstation (`v2/apps/desk/src/modules/DeskPage.tsx`)
- Container: `h-full flex flex-col gap-2.5 overflow-hidden`.
- Bento KPI Row: Compact height `h-[74px] shrink-0`.
- Floor Map Strip: Compact height `h-[38px] shrink-0`.
- Dual-Pane Split (65% / 35%): `flex-1 min-h-0 grid grid-cols-12 gap-3 overflow-hidden`.
- Left Stay Worklist: `flex-1 overflow-y-auto pr-1 space-y-2` (internal scroll only).
- Right Operations Radar: `flex flex-col h-full overflow-y-auto space-y-2 pr-1`.

### Task 4: Mobile StayView & FastBook
- In `StayViewPage.tsx`: Switch to a horizontal swipeable Date Carousel + room cards list on mobile screens.
- In `FastBookModal.tsx`: Render as a native iOS bottom drawer using `vaul` on mobile screens.

---

## 3. Verification Commands
- `pnpm --filter @hos-v2/desk typecheck` (0 errors)
- `pnpm --filter @hos-v2/desk build` (clean production build)
