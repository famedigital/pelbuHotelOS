# Hotel OS v2: Sovereign Onboarding Wizard & Interactive Staff Tour Specification

> **Target Platform:** `v2/apps/desk` and `v2/packages/ui`  
> **Role:** Cursor Composer Execution Brief  
> **Design Language:** Apple VisionOS Spatial Glass × Linear Motion Physics × Bhutanese Sovereign Luxury  

---

## 1. Executive Overview

This specification directs Cursor Composer to implement two motion-driven onboarding experiences:

1. **The Sovereign Hotel Onboarding Wizard (`HotelOnboardingWizard.tsx`):**  
   A 5-step spatial glass modal wizard that runs on the very first login of a new hotel property to configure Brand Identity, Inventory/Floors, DRC Fiscal Rules, and the Sovereign Staff PIN, concluding with a celebratory commissioning launch.
2. **The Interactive First-Time Staff Guided Tour (`InteractiveStaffTour.tsx`):**  
   A 7-step spotlight walkthrough that triggers after onboarding (or on first staff login). It dims the screen, places a glowing beacon ring over each mission control element, and shows a floating glass card explaining exactly where to click and what to do.

---

## 2. Component 1: The Sovereign Hotel Onboarding Wizard

### File: `v2/apps/desk/src/modules/HotelOnboardingWizard.tsx`

### Motion & Optical Architecture
- **Backdrop:** Dimmed obsidian glass (`bg-slate-950/80 backdrop-blur-xl`) with radial celestial ambient light.
- **Chassis:** Floating centered modal (width: `800px`, height: `620px`, `rounded-2xl`, border with `inset 0 1px 1px rgba(255, 255, 255, 0.2)` specular rim).
- **Page Transitions:** Framer Motion `AnimatePresence mode="wait"` with directional spring slides (`variants={{ enter: (d) => ({ x: d > 0 ? 40 : -40, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d) => ({ x: d < 0 ? 40 : -40, opacity: 0 }) }}`).
- **Liquid Step Bar:** Connected progress track showing completed steps with emerald checkmarks and current step with a pulsing blue halo.

### Step-by-Step Flow

#### Step 1: Sovereign Identity & Brand Crest
- **Hotel Official Name:** High-contrast text input (e.g. *Pelbu Suites*).
- **Dzongkhag / Valley Selector:** Dropdown for all 7 Bhutanese tourism dzongkhags (*Thimphu, Paro, Punakha, Bumthang, Wangdue, Haa, Trashigang*).
- **Department of Tourism (DoT) Star Classification:** 1 to 5 interactive golden star buttons with fill animation.
- **Trade License & TPN:** Official Bhutanese tax registration inputs (*TL-THIM-2026-9041*, *BTN-TPN-109482*).

#### Step 2: Inventory Architecture & Floor Racks
- **Total Rooms Stepper:** Tactile `−` and `+` circular buttons (4 to 120 rooms).
- **Floors Count Stepper:** 1 to 8 floors (generates `F1`, `F2`, `F3`... in the tape chart).
- **Rack Rate Inputs:** Base nightly net rack rates in Bhutan Ngultrum (`Nu.`) for Deluxe King (`DLX`) and Valley Suite (`VAL`).

#### Step 3: DRC Fiscal Rules & Cashier Float
- **10% Service Charge (SC Tip Pool) Switch:** Toggles automated daily staff tip pool allocation.
- **10% Bhutan Sales Tax (BST) Switch:** Toggles automated DRC Form BST-3 tax accrual.
- **Starting Cashier Till Float:** Instant selector pills (`Nu. 5,000`, `Nu. 10,000`, `Nu. 20,000`) for the drawer float used for CFM vegetable market advances and change.

#### Step 4: Sovereign Staff PIN & Shift Schedule
- **Lead Cashier / GM Name:** Input (e.g. *Karma Dorji*).
- **4-Digit Sovereign PIN:** Obfuscated high-contrast numeric input (e.g. `1234`) for the PIN gateway.
- **Shift Schedule:** Displays Shift 1 Morning (`07:00 – 15:00`) with live emerald status indicator.

#### Step 5: Grand Commissioning & Launch
- **Celebration Hero:** Golden 3D crown badge with celebratory checkmark and particle animation.
- **Summary Bento:** Property name, stars, total rooms, starting float, and active tax rules.
- **Primary CTA:** Gradient button: `[Launch Sovereign Cockpit 🚀]` that writes state, closes the wizard, and seamlessly opens the Staff Guided Tour!

---

## 3. Component 2: The Interactive First-Time Staff Guided Tour

### File: `v2/apps/desk/src/modules/InteractiveStaffTour.tsx`

### Spotlight & Guidance Architecture
- **Overlay:** Subtle darkened backdrop (`bg-slate-950/60 backdrop-blur-[3px]`) that darkens non-targeted areas.
- **Floating Callout Card:** Width `480px`, styled with `.hos-luxury-card`, top blue ambient lighting tint, and spring entry/exit.
- **Step Dots:** Dynamic progress pills showing completed steps in emerald and active step in glowing sapphire.
- **Controls:** `[Back]`, `[Skip]`, and `[Next →]` (or `[Get Started ✓]` on step 7).

### The 7 Guided Tour Steps

| Step | Target Selector | Step Title | Guidance Description |
| :--- | :--- | :--- | :--- |
| **1** | `[data-tour="header"]` | **Executive Flight Deck Header** | *"This 46px command bar displays your live Cashier Till float with pulsing emerald radar dot, business date (Shift 1), quick print studio, and staff PIN switch."* |
| **2** | `[data-tour="fast-book"]` | **Fast Book Studio (⌘B)** | *"Create walk-in reservations in under 8 seconds. Press ⌘B anywhere to open tactile steppers for adults/children, room categories with live availability, and DRC BST-3 tax quotes."* |
| **3** | `[data-tour="kpis"]` | **Bento KPI Mission Ribbon** | *"Monitor Occupancy %, RevPAR Yield, Arrivals flight status (with unassigned room alerts), and real-time Housekeeping room readiness without leaving row 1."* |
| **4** | `[data-tour="floormap"]` | **Floor Map Quick Strip** | *"Every room across all floors is rendered as an interactive tactile jewel tile. Click any room chip to immediately open the guest folio or inspect room status."* |
| **5** | `[data-tour="worklist"]` | **Luxury Boarding-Pass Worklist** | *"Guest reservations are styled as luxury travel boarding passes with nationality flags, meal plan pills, settled/due chips, and 1-tap 'Check In (Keycard Encode)' triggers."* |
| **6** | `[data-tour="radar"]` | **Operations Radar & Till Vault** | *"Keep watch over active VIP guests and personalized stay preferences (Cordyceps Tea, Quiet Floor), Tour Group rosters, and execute CFM vegetable market till advances."* |
| **7** | `[data-tour="search"]` | **Command Palette & Voice Dispatcher (⌘K / ⌘J)** | *"You are in full command! Press ⌘K to search any guest, voucher, or room number instantly. Press ⌘J to execute natural language dispatching."* |

---

## 4. State Management & Lifecycle Wiring

### File: `v2/apps/desk/src/lib/settings-store.ts`

Add the following state and actions to `useSettingsStore`:

```typescript
type OnboardingState = {
  hasCompletedHotelOnboarding: boolean;
  hasCompletedStaffTour: boolean;
  isHotelOnboardingOpen: boolean;
  isStaffTourOpen: boolean;
  
  openHotelOnboarding: () => void;
  closeHotelOnboarding: () => void;
  completeHotelOnboarding: (patch: {
    hotelName: string;
    dzongkhag: Dzongkhag;
    dotStars: number;
    tradeLicense: string;
    tpn: string;
    scEnabled: boolean;
    bstEnabled: boolean;
    roomsCount?: number;
    startingTill?: number;
  }) => void;
  
  startStaffTour: () => void;
  closeStaffTour: () => void;
  completeStaffTour: () => void;
};
```

### Automatic Sequencing Logic
1. When a user loads the app and `localStorage.getItem("hos_hotel_onboarded") !== "true"`, `isHotelOnboardingOpen` is initialized to `true`.
2. When the user completes Step 5 of the Onboarding Wizard:
   - Sets `hasCompletedHotelOnboarding: true` in state and `localStorage`.
   - Closes the Onboarding Wizard.
   - Sets `isStaffTourOpen: true`, immediately launching the Guided Staff Tour without a reload.
3. When the user finishes the Guided Staff Tour:
   - Sets `hasCompletedStaffTour: true` in state and `localStorage`.
   - Dispatches a success toast: `"You're all set to operate Hotel OS Sovereign Desk."`
4. Both can be re-triggered anytime from Settings or by pressing `?` in the keyboard shortcut cheat sheet.

---

## 5. Mounting into the Shell (`App.tsx`)

In `v2/apps/desk/src/shell/App.tsx`:
1. Mount `<HotelOnboardingWizard />` and `<InteractiveStaffTour />` alongside `<FastBookModal />` and `<StayHubDrawer />`.
2. Add the corresponding `data-tour` attributes to the shell components:
   - `header`: `data-tour="header"`
   - Search button: `data-tour="search"`
   - Fast Book button: `data-tour="fast-book"`
3. In `v2/apps/desk/src/modules/DeskPage.tsx`:
   - Top Bento KPI row: `data-tour="kpis"`
   - Floor map quick strip: `data-tour="floormap"`
   - Left Worklist container: `data-tour="worklist"`
   - Right Operations radar: `data-tour="radar"`

---

## 6. Cellular-Level Design Tokens

Ensure the following micro-tokens from `v2/packages/ui/src/tokens.css` are leveraged:
- `.hos-surface-glass`: 20px blur, specular rim highlight, ambient diffusion shadow.
- `.hos-luxury-card`: Opaque cellular background, 0.2s cubic-bezier lift on hover.
- `.hos-btn-spring`: Tactile press physics with active `scale(0.97) translateY(1px)`.
- **Typography:** Enforce `font-family: 'Plus Jakarta Sans'` for prose/headings and `'JetBrains Mono'` for numbers and dates.

---

## 7. Verification & Build Directives

Run the following checks to guarantee 0 regressions:
1. `cd v2 && pnpm --filter @hos-v2/desk typecheck` (Must output 0 errors).
2. `cd v2 && pnpm --filter @hos-v2/desk build` (Must produce production bundle cleanly in ~9 seconds).
3. Test in browser at `http://localhost:5174/` to verify smooth Framer Motion spring physics and clean dismissals.
