# Cursor Brief: Build Mobile & Tablet Experience from Scratch (Level 0 to 100)

**Target:** Mobile and tablet are **NOT** responsive CSS scaling. They are dedicated, touch-native, handheld-first applications built from scratch in `v2/apps/desk/src/`.

---

## 1. Specification Reference
- Read [`docs/v2/MOBILE-TABLET-FROM-SCRATCH-SPEC.md`](../../docs/v2/MOBILE-TABLET-FROM-SCRATCH-SPEC.md) for full wireframes and interactions.

---

## 2. Implementation Worklist

### File 1: `v2/apps/desk/src/shell/App.tsx`
- On `<768px`: Hide desktop sidebar and header. Mount `MobileNav.tsx` bottom dock (58px) with 5 core tabs (Desk, StayView, Rooms, POS, More) and compact 46px mobile top bar.
- On `768px–1024px`: Mount collapsed 64px icon rail.
- On `≥1024px`: Mount 100vh locked zero-scroll desktop cockpit.

### File 2: `v2/apps/desk/src/modules/DeskPage.tsx`
- On `<768px`, render dedicated `DeskMobileView`:
  - Horizontal swipeable KPI metric strip.
  - Quick barcode/search input.
  - Large thumb-friendly guest cards with 1-tap `[⚡ Check In]`, `[Keycard]`, `[StayHub]`.

### File 3: `v2/apps/desk/src/modules/StayViewPage.tsx`
- On `<768px`, render dedicated `StayViewMobileView`:
  - Horizontal swipeable calendar date carousel (`[Today 08] [Thu 09] [Fri 10]...`).
  - Vertical tactile room card list for the active date with 1-tap booking/assignment.

### File 4: `v2/apps/desk/src/modules/HousekeepingPage.tsx`
- On `<768px`, render dedicated "Hallway Mode":
  - 2-column large room tiles with 1-tap status toggles (`Clean 🟢`, `Dirty 🟡`, `Cleaning 🔵`, `OOO 🔴`).
  - Priority turnover alerts on checkout rooms.

### File 5: `v2/apps/desk/src/modules/PosPage.tsx`
- On `<768px`, render dedicated `PosMobileView`:
  - Handheld waiter table grid, category carousel, tap-to-add steppers, and large bottom **Fire KOT** button.

### File 6: `v2/apps/desk/src/modules/FastBookModal.tsx` & `StayHubDrawer.tsx`
- On `<768px`, render as native iOS bottom drawers using `vaul` with swipe-to-dismiss gesture.

---

## 3. Verification Commands
- `pnpm --filter @hos-v2/desk typecheck` (0 errors)
- `pnpm --filter @hos-v2/desk build` (clean production build)
