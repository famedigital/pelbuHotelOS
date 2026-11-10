# CURSOR COMPOSER: MASTER PROMPT FOR HOTEL OS v2 (ALL UPGRADES)

Execute the full specification defined in `docs/v2/MASTER-CURSOR-BLUEPRINT.md`:

```markdown
# MISSION BRIEF: IMPLEMENT HOTEL OS v2 FROM CELLULAR PRIMITIVES TO SOVEREIGN INTELLIGENCE

Execute all 5 layers defined in docs/v2/MASTER-CURSOR-BLUEPRINT.md without stubs, placeholders, or superficial code:

### LAYER 0: CELLULAR & MICRO-LEVEL PRIMITIVES
1. Typography & Numerics: Enforce Plus Jakarta Sans for UI text and JetBrains Mono for all currencies, room numbers, and dates. Apply tabular figure alignment.
2. Photonic Status Indicators: Implement multi-layer breathing LedBeacon dots (Emerald till/clean, Sapphire in-house, Brass dirty, Ruby OOO/block, Violet DND).
3. 3D Mechanical Keycaps: Style keycaps (⌘K, ⌘B, ⌘J, Esc) with specular rim light and 1.5px physical drop shadow.
4. Linear-Grade Keyboard Navigation: Enable J/K navigation, C for Check-In, O for Check-Out, X for batch select, ? for shortcuts modal, and ⌘Z for 5s undo toast.

### LAYER 1: 100VH ZERO-SCROLL DESKTOP COCKPIT
1. Executive Header (46px): 28px brand crest with crown icon, till float chip with pulsing emerald dot, business date (Shift 1), fast book CTA, and PIN switch.
2. Bento KPI Ribbon (74px): 5 jewel-toned cards (Occupancy %, Yield/RevPAR, Arrivals flight alerts, Departures check, Housekeeping status).
3. Floor Map Quick Strip (38px): Interactive room tiles color-coded by HK status.
4. Dual-Pane Workstation (65/35):
   - Left Worklist: Luxury Boarding Passes with state accent stripe, nationality flags, meal plan pills, settled/due chips, and tactile spring action buttons.
   - Right Radar: VIP radar with stay preferences, Tour Group rosters with guide/bus telemetry, and Cashier Till vault with advance/drop actions.

### LAYER 2: STUDIO EXPERIENCES & DRAWERS
1. FastBook Studio (⌘B): Floating obsidian modal with tactile steppers for adults/children, room category cards with live availability, and real-time DRC Form BST-3 quotation receipt.
2. StayHub Master Drawer: Dual-stream folio selector with Night-by-Night Daily Rate & Meal Matrix (N1, N2...) and 1-tap "Copy N1 to all ↷".

### LAYER 3: DEDICATED MOBILE & TABLET (<1024px)
1. 58px floating bottom glass dock (Desk, Tape, Housekeeping, POS, More).
2. Mobile StayView with swipeable horizontal Date Carousel.
3. Housekeeping "Hallway Mode" (2-column tactile room tiles).
4. Handheld Waiter POS with category pills, quantity steppers, and full-width bottom "Fire KOT" button.
5. Native vaul bottom sheet drawers with swipe-to-dismiss.

### LAYER 4: SOVEREIGN ONBOARDING & FIRST-TIME STAFF TOUR
1. Hotel Onboarding Wizard (HotelOnboardingWizard.tsx): 5-step spatial glass modal wizard with liquid step indicator (Identity, Inventory, DRC Fiscal, Front Desk PIN, Grand Launch).
2. Interactive Staff Guided Tour (InteractiveStaffTour.tsx): 7-step guided spotlight tour highlighting Header, Fast Book, Bento KPIs, Floor Map, Worklist, Radar, and Command Palette.
3. Automatic sequencing: Completing Hotel Onboarding seamlessly launches the Staff Guided Tour.

### LAYER 5: SOVEREIGN INTELLIGENCE & AUTOMATION
1. Intelligent Tetris Room Auto-Assigner: Clusters tour groups on same floor, elevates VIPs to top floor, eliminates 1-night orphaned room gaps.
2. Autonomous 1-Click Night Audit: Pre-flight checks, atomic nightly rate/tax posting, date advance in 1.2s.
3. Natural Language Action Dispatcher (⌘J): Voice/text command parser for instant front desk mutations.
4. Offline-Resilient Transaction Buffer: IndexedDB queue to withstand mountain power/fiber dropouts.
5. Official DRC Form BST-3 & Police Immigration Manifest Exporter.

### VERIFICATION
- Run `cd v2 && pnpm --filter @hos-v2/desk typecheck` (Must pass with 0 errors).
- Run `cd v2 && pnpm --filter @hos-v2/desk build` (Must build production bundles cleanly).
```
