# Mobile & Tablet UI/UX Enterprise Redesign Specification

> **Target:** Cursor Composer / Implementer / Frontend Engineers  
> **Scope:** Complete redesign of Mobile (< 768px) and Tablet (768px – 1024px) UI across Desk ERP (`/erp`), Staff App (`/staff`), POS (`/erp/pos`), and Public Booking (`/book`, `/`).  
> **Design Language:** **VisionOS Floating Glass Ergonomics × Thumb-Zone Touch Architecture.**

---

## 1. Ergonomic Architecture: The "Thumb-Zone" First Standard

Front-desk staff on iPad stands and roaming staff on smartphones must operate with zero finger gymnastics.

```
┌───────────────────────────────────────────────┐
│ [TOP BAR: 10% SCREEN HEIGHT]                  │  Hard-to-reach zone: Status indicators,
│ • Hotel Logo, Property Pill, Connection Badge │  Offline sync pulse, notifications only.
├───────────────────────────────────────────────┤
│ [CONTENT ZONE: 60% SCREEN HEIGHT]             │
│ • Adaptive Calendar Rack (7-Day Matrix)       │  Natural viewing zone:
│ • Guest Details, Folio Ledger, Room Cards     │  High contrast, scrollable, touch-friendly.
│ • High-performance CSS containment           │
├───────────────────────────────────────────────┤
│ [THUMB ACTION ZONE: 30% SCREEN HEIGHT]        │
│ • Primary CTA (Check-In, Settle, Quick Post)  │  Easy natural thumb reach:
│ • Floating 3D Glass Tab Dock                  │  Large touch targets (>= 48px), haptic feel.
│ • Bottom Sheet Drawers (StayHub, Cashier)     │
└───────────────────────────────────────────────┘
```

---

## 2. Breakpoint Matrix & Device Adapters

| Device Type | Viewport Width | Layout Strategy | Navigation Pattern |
| :--- | :--- | :--- | :--- |
| **Smartphone** | `< 768px` | Single-column fluid; cards over tables; bottom sheets (`vaul`/Radix drawer). | Floating Glass Bottom Dock with 5 primary thumb icons + "More" drawer. |
| **Tablet Portrait** | `768px – 1023px` | Master-Detail 2-column split (35% Left List / 65% Right Detail Pane). | Slim Icon Rail (Left) or Floating Bottom Tab Dock. |
| **Tablet Landscape** | `1024px – 1280px` | Compact desktop grid; touch-expanded hitboxes ($\ge 44\text{px}$). | Pinned Left Glass Sidebar (auto-collapsed icon rail). |

---

## 3. Core Mobile/Tablet Design Tokens (`web/src/app/globals.css`)

Add these mobile-specific responsive utility tokens:

```css
/* =========================================================================
   Mobile & Tablet Ergonomic Tokens (dvh & Safe-Area Aware)
   ========================================================================= */

:root {
  /* Dynamic viewport height handling (prevents iOS address bar jump) */
  --app-height: 100dvh;
  --touch-target-min: 44px;
  --touch-target-optimal: 48px;
  --mobile-dock-height: 4rem;
}

/* Floating 3D Glass Bottom Dock */
.glass-dock-mobile {
  position: fixed;
  bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%) translateZ(0);
  width: calc(100% - 1.5rem);
  max-width: 480px;
  height: var(--mobile-dock-height);
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.2), 0 20px 40px -10px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 9999px; /* Pill Shape */
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 0.5rem;
}

.light .glass-dock-mobile {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.85), 0 15px 35px -5px rgba(0, 0, 0, 0.1);
}

/* Tactile Micro-Press Feedback */
.touch-press {
  transition: transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.12s ease;
}
.touch-press:active {
  transform: scale(0.94);
  opacity: 0.85;
}

/* Safe-area padding helper */
.pb-safe-dock {
  padding-bottom: calc(var(--mobile-dock-height) + 1.5rem + env(safe-area-inset-bottom, 0px));
}
```

---

## 4. Key Subsystem Redesigns

### A. Front Desk Room Calendar on Tablet & Mobile (`/erp/calendar`)
* **Desktop vs Mobile Problem:** A 30-day $\times$ 100-room grid cannot fit on a phone or iPad without unreadable text and horizontal dragging misery.
* **The Solution:**
  1. **Smartphone Mode (< 768px):** Automatically switches from a 2D matrix to the **"Day Sheet Agenda"**:
     - Horizontal swipeable Date Bar (showing 7 days: Today -3 to +3).
     - Vertical cards grouped by Room Category (e.g. Deluxe Suite: 4 Occupied, 1 Due Out, 1 Dirty).
     - Tap any card $\rightarrow$ Opens StayHub Bottom Sheet instantly.
  2. **Tablet Mode (768px – 1024px):**
     - Constrained to **5-Day or 7-Day Matrix View** with pinch-to-zoom date density.
     - Sticky Room Number column with quick status badge (Emerald for Clean, Ruby for Dirty).

---

### B. StayHub Bottom Sheet Drawer (`web/src/components/erp/stay-hub/StayHubMobileDrawer.tsx`)
* On mobile and tablets, modals that take over the full desktop screen feel claustrophobic and break keyboard interactions.
* **The Solution:** A native swipeable bottom sheet (using Radix / Vaul):
  * **Handlebar at top** for drag-to-dismiss gesture.
  * **Quick Folio Balance Pill** pinned at top right (`BTN 0.00` in Emerald / `BTN 2,400` in Amber).
  * **Sticky Bottom Action Dock:** `[Charge Incidentals]` and `[Check Out Guest]` pinned permanently above the thumb zone.
  * Virtualized ledger list scrolling smoothly without pushing action buttons off-screen.

---

### C. Public Booking Funnel on Mobile (`/book`)
* **Problem:** Complex multi-step date pickers and room cards drop conversion on smartphones.
* **The Solution:**
  1. **3D Floating Search Capsule:** Sticky pill at top showing: `📅 Oct 20–24 • 2 Guests • [Edit]`.
  2. **3D Spatial Room Carousel:** Rooms presented as horizontal swipeable cards (`overflow-x-auto snap-x snap-mandatory`):
     - Interactive 3D room preview with touch rotation.
     - Luminous price pill: `BTN 6,500 / night`.
  3. **Sticky Instant-Reserve Bar:** Fixed to the bottom screen:
     - Shows selected room + total with tax.
     - Full-width Sovereign Gold CTA: `[Reserve in 20s →]`.

---

### D. Staff Housekeeping & Maintenance View (`/staff`)
* Designed for room attendants holding a phone in one hand while inspecting a bed:
  * **Big 64px Status Toggle Tiles:** Clean, Inspected, Dirty, Priority.
  * **One-Tap Maintenance Reporting:** Tap camera icon $\rightarrow$ native mobile photo capture $\rightarrow$ uploads repair ticket.
  * **Offline Sync Badge:** Green pulse when connected; yellow banner when offline (saves updates in IndexedDB and syncs upon reconnection).

---

## 5. Technical Requirements & Best Practices for Cursor

When implementing mobile/tablet components:
1. **Zero Layout Shifts:** Always use `100dvh` for full-height drawers/screens (`h-[100dvh]` or `min-h-[100dvh]`).
2. **Hit Target Sizing:** Ensure every button, tab, and icon button has a minimum hitbox of `44px × 44px` (`min-h-11 min-w-11`).
3. **No Accidental Text Selection:** Add `select-none` to all interactive touch buttons and gesture handles.
4. **Haptic Touch Classes:** Apply `.touch-press` to all interactive buttons for immediate tactile feedback.
5. **Form Inputs on Mobile:**
   - Use `inputMode="numeric"` on PIN and amount fields to trigger the numeric keypad on iOS/Android.
   - Use `fontSize: 16px` minimum on inputs to prevent iOS Safari from automatically zooming into the page.

---

## 6. Cursor Implementation Instructions

Feed this prompt to Cursor to trigger the mobile/tablet redesign:

> *"Execute the mobile and tablet UI redesign defined in [`docs/architecture/MOBILE-TABLET-REDESIGN.md`](file:///c:/GitHub/Hotel%20OS%20Bhutan/docs/architecture/MOBILE-TABLET-REDESIGN.md). Refactor `DeskMobileNav.tsx` and `StaffMobileNav.tsx` into the floating 3D glass dock (`.glass-dock-mobile`), implement `StayHubMobileDrawer.tsx`, and adapt the calendar rack to the 7-day Agenda card view on screens < 768px. Verify with `pnpm --dir web run typecheck`."*
