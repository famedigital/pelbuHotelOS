# CURSOR COMPOSER BRIEF: SOVEREIGN HOTEL ONBOARDING WIZARD & FIRST-TIME STAFF TOUR

> **Specification Reference:** `docs/v2/ONBOARDING-WIZARD-AND-STAFF-TOUR-SPEC.md`  
> **Target Apps:** `v2/apps/desk` and `v2/packages/ui`  

## 1. Directive
Implement the **Sovereign Hotel Onboarding Wizard** and the **Interactive First-Time Staff Guided Tour** in Hotel OS v2.
Follow the exact motion design, step sequence, and state management defined in [`docs/v2/ONBOARDING-WIZARD-AND-STAFF-TOUR-SPEC.md`](../../docs/v2/ONBOARDING-WIZARD-AND-STAFF-TOUR-SPEC.md).

## 2. Key Files to Implement / Modify
1. **`v2/apps/desk/src/modules/HotelOnboardingWizard.tsx`:**
   - 5-step spatial glass modal wizard with `AnimatePresence mode="wait"` directional spring slides.
   - Liquid step indicator connecting steps 1 through 5.
   - Steps:
     - 1: Identity & DoT Stars (Hotel name, Dzongkhag dropdown, 1-5 gold stars, trade license, TPN).
     - 2: Rooms & Inventory (Rooms count stepper, floors stepper, base rack rate inputs).
     - 3: Fiscal & DRC Rules (10% SC tip pool toggle, 10% BST toggle, starting till float selector).
     - 4: Front Desk PIN & Shift (GM name, 4-digit PIN, Shift 1 schedule).
     - 5: Grand Commissioning Celebration (Celebratory crown badge, summary bento, Launch CTA).
2. **`v2/apps/desk/src/modules/InteractiveStaffTour.tsx`:**
   - 7-step guided spotlight tour with darkened backdrop, floating glass guidance card, step dots, and back/next/skip controls.
   - Highlights: Header, Fast Book (⌘B), Bento KPIs, Floor Map Strip, Worklist Boarding Passes, Operations Radar, and Command Palette (⌘K / ⌘J).
3. **`v2/apps/desk/src/lib/settings-store.ts`:**
   - Add state: `hasCompletedHotelOnboarding`, `hasCompletedStaffTour`, `isHotelOnboardingOpen`, `isStaffTourOpen`.
   - Add actions: `openHotelOnboarding`, `closeHotelOnboarding`, `completeHotelOnboarding`, `startStaffTour`, `closeStaffTour`, `completeStaffTour`.
   - Sequencing: Completing hotel onboarding automatically opens the staff tour.
4. **`v2/apps/desk/src/shell/App.tsx`:**
   - Mount `<HotelOnboardingWizard />` and `<InteractiveStaffTour />`.
   - Add `data-tour="header"`, `data-tour="search"`, `data-tour="fast-book"`.
5. **`v2/apps/desk/src/modules/DeskPage.tsx`:**
   - Add `data-tour="kpis"`, `data-tour="floormap"`, `data-tour="worklist"`, `data-tour="radar"`.

## 3. Verification
- `cd v2 && pnpm --filter @hos-v2/desk typecheck` (0 errors).
- `cd v2 && pnpm --filter @hos-v2/desk build` (passes cleanly).
