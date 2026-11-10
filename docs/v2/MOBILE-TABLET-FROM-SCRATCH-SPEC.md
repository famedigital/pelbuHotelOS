# Hotel OS v2: Mobile & Tablet Ground-Up Architecture (Level 0 to 100)

> **Core Mandate:** Mobile and tablet are **NOT** responsive CSS afterthoughts. They are **dedicated, touch-native, handheld-first applications built from scratch** for hotel staff operating on phones and tablets.

---

## 1. Adaptive Device Tier Matrix

| Tier | Viewport | Target Device | Primary UI Shell | Interaction Paradigm |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile** | `<768px` | iPhone / Android | **Native iOS/Android Bottom Dock + Sticky Top Bar** | One-thumb ergonomics, swipe gestures, native bottom sheets (`vaul`), zero horizontal scrolling. |
| **Tablet** | `768px–1024px`| iPad / Surface | **Adaptive 64px Icon Rail + Multi-Column Grid** | Two-handed touch, split worklists, 48px touch targets, side-sheet inspectors. |
| **Desktop**| `≥1024px` | 1080p / 1440p | **100vh Locked Zero-Scroll Cockpit** | Keyboard shortcuts (`⌘B`, `⌘K`), maximum data density, internal scrollbars only. |

---

## 2. Dedicated Handheld Workstations Built from Scratch

```
┌────────────────────────────────────────────────────────────────────────┐
│ MOBILE DESK TODAY (PHONE <768px)                                       │
├────────────────────────────────────────────────────────────────────────┤
│ [P] Pelbu Suites ★★★★                  Till: Nu. 48,250 | [KD]         │
├────────────────────────────────────────────────────────────────────────┤
│ HORIZONTAL KPI SWIPE STRIP                                             │
│ [ 78% Occ Tonight ]  [ 8 Arrivals Today ]  [ 6 Departures ]  [ Nu. 142k ]│
├────────────────────────────────────────────────────────────────────────┤
│ 🔍 [Search guest, room #, voucher...]                     [+ FastBook] │
├────────────────────────────────────────────────────────────────────────┤
│ SEGMENT PILL SLIDER                                                    │
│ [Arrivals (8)]   [In-House (14)]   [Departures (6)]   [Tomorrow (5)]   │
├────────────────────────────────────────────────────────────────────────┤
│ GUEST CARD (ONE-THUMB ERGONOMICS)                                      │
│ +--------------------------------------------------------------------+ │
│ | [SJ] Dr. Sarah Jenkins ★ VIP      Rm 204 · DLX-K    Nu. 0.00       | │
│ |      PS-2026-1402 · 11-08 → 11-12 (4N) · MAP        Settled 🟢     | │
│ |      [⚡ Instant Check In]   [Encode Keycard]   [StayHub Drawer]    | │
│ +--------------------------------------------------------------------+ │
│ | [TK] Tshering Karma               Rm 102 · DLX-T    Nu. 12,450 Due | │
│ |      PS-2026-1403 · 11-08 → 11-10 (2N) · CP         Pending 🔴     | │
│ |      [⚡ Instant Check In]   [Encode Keycard]   [StayHub Drawer]    | │
│ +--------------------------------------------------------------------+ │
├────────────────────────────────────────────────────────────────────────┤
│ NATIVE BOTTOM NAVIGATION DOCK (FIXED AT BOTTOM, 58px + SAFE AREA)      │
│  🏨 Desk        📊 Tape        🛏️ Rooms       🍽️ POS        ☰ More     │
│   (Today)       (Carousel)     (Hallway)      (Orders)     (31 Apps)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 5 Dedicated Mobile Views Built from Scratch

### 1. Mobile Desk Today (`DeskMobileView.tsx`)
- **Swipeable Metric Strip:** Compact horizontal swipe strip for live occupancy, revenue, arrivals, and departures.
- **Thumb-Friendly Action Cards:** Guest cards feature large 48px touch buttons for `⚡ Instant Check In`, `Encode Keycard`, and `StayHub`.
- **Swipe-to-Action Gestures:** Swipe card right to trigger check-in; swipe left to open StayHub folio.

### 2. Mobile StayView Date Carousel (`StayViewMobileView.tsx`)
A 30-day desktop table is completely unreadable on a 390px mobile screen.
- **Horizontal Swipeable Date Strip:**
  ```
  [ Today 08 ]  [ Thu 09 ]  [ Fri 10 ]  [ Sat 11 ]  [ Sun 12 ]
     Occ 78%       Occ 85%     Occ 92%     Occ 60%     Occ 40%
  ```
- **Vertical Room Card List for Selected Date:**
  - Displays each room as a clean, tactile tile.
  - If occupied: Guest avatar, name, stay length, and quick folio balance chip.
  - If vacant: 1-tap **"Book Room"** or **"Assign Guest"** button.

### 3. Housekeeping "Hallway Mode" (`HousekeepingMobileView.tsx`)
Designed specifically for room attendants walking hotel corridors with a mobile phone:
- **Floor Switcher:** Large thumb pills for `Floor 1`, `Floor 2`, `Floor 3`.
- **High-Contrast Room Grid:** 2-column large room cards with high-visibility status:
  - `Clean Ready 🟢`, `Dirty 🟡`, `Cleaning 🔵`, `Out of Order 🔴`.
- **1-Tap Quick Actions:**
  - Single tap changes status (`Dirty → Cleaning → Clean Ready`).
  - **Priority Turnover Alerts:** Flashing badge on rooms where the guest has checked out and the next arrival is en-route.
  - **Maintenance Camera Upload:** Built-in mobile camera button to snap and attach photos of broken fixtures or linen stains.

### 4. Handheld Waiter F&B POS (`PosMobileView.tsx`)
Built for restaurant and room-service staff taking orders tableside:
- **Visual Table Grid:** Touch-friendly floor map tiles (`Table 1` to `Table 12` + `Room Service`).
- **Category Pill Bar:** `Beverages`, `Mains`, `Snacks`, `Desserts`.
- **Item Cards with Quick Steppers:** Tap to add, `+` and `−` counter to adjust quantity.
- **Guest Room Posting:** Quick room lookup (`Rm 204 · Dr. Sarah Jenkins`) to post directly to the guest's personal folio with one tap.
- **Instant KOT Fire Button:** Large bottom-anchored button sending order ticket directly to kitchen printers / KDS.

### 5. Native Bottom Sheet Drawers (`vaul`)
- **FastBook Mobile Sheet:** Opens as a native iOS bottom sheet (92dvh) with top drag handle:
  - Large numeric steppers for rooms and guests.
  - Visual category selection cards.
  - Sticky bottom **"Confirm Booking"** button positioned safely above the mobile virtual keyboard.
- **StayHub Mobile Sheet:** Full folio balance breakdown, night-by-night pricing table, and 1-tap settlement options (Cash, RMA mBoB QR).

---

## 4. Tablet Adaptive Architecture (768px to 1024px)

1. **64px Collapsible Icon Rail:**
   - Sidebar automatically collapses into a vertical icon-only dock with hover/tap tooltip flyouts.
2. **Adaptive 2x2 Bento Grid:**
   - KPI metrics wrap cleanly into a 2-column or 3-column touch layout.
3. **Split Workstation (60% / 40%):**
   - Left side displays the stay worklist; right side displays the operations radar without overlapping.

---

## 5. Technical Implementation Blueprint for Cursor

Execute these dedicated components in `v2/apps/desk/src/`:

1. **`src/shell/App.tsx`:**
   - Detect screen width or use CSS media queries:
     - On `<768px`: Render `MobileNav.tsx` bottom dock, hide desktop sidebar and desktop header.
     - On `768px–1024px`: Render collapsed 64px icon rail.
     - On `≥1024px`: Render 100vh locked desktop zero-scroll cockpit.
2. **`src/modules/DeskPage.tsx`:**
   - Render `DeskMobileView` on `<768px` and `DeskDesktopView` on `≥768px`.
3. **`src/modules/StayViewPage.tsx`:**
   - Render `StayViewMobileView` (Date Carousel + Room Stack) on `<768px`.
4. **`src/modules/HousekeepingPage.tsx`:**
   - Render "Hallway Mode" mobile cards on `<768px`.
5. **`src/modules/FastBookModal.tsx`:**
   - Use `vaul` drawer for mobile screens and centered modal for desktop.
