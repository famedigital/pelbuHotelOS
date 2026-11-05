# The Sovereign Glass & 0-Latency Architecture (ECCD & Atheros Benchmark)

> **Authoritative Benchmark:** Adopted from `C:\GitHub\POS\docs\MASTER-DESIGN-SYSTEM.md` (ECCD & GoKora v2).  
> **Mandate:** Replace all slow, laggy network-dependent screens and muddy UI in Hotel OS with the **0-Latency RAM-First Architecture** and **Atheros 3D Tactile Specular Glass**.

---

## 1. The 3 Inviolable Laws of Speed & Aesthetics

```
┌────────────────────────────────────────────────────────────────────────┐
│               THE SPEED & TACTILE TRIAD (ECCD STANDARD)               │
├────────────────────────┬───────────────────────┬───────────────────────┤
│ 1. THE 0-LATENCY LAW   │ 2. THE 3D TACTILE     │ 3. THE DUAL-SURFACE   │
│ (RAM FIRST)            │ GLASS LAW (ATHEROS)   │ LAW                   │
│ Keystrokes, filters,   │ Frosted crystal glass │ Desktop: Linear-power │
│ tabs & search execute  │ (blur 24px), 1px top  │ Ctrl+K + Dense Pine   │
│ in 0 – 2ms in CPU RAM. │ specular highlight,   │ Spreadsheets.         │
│ Network is strictly    │ milled ceramic feel.  │ Mobile: 100% thumb    │
│ background SWR reval.  │ No flat gray boxes.   │ cockpit + bottom sheet│
└────────────────────────┴───────────────────────┴───────────────────────┘
```

---

## 2. Dual-Theme Design Tokens: "Frosted Ceramic" & "Smoked Obsidian"

### 2.1 Color Tokens & Specifications
* **Royal Bhutan Pine Green:** `#1a4332` (Light) / `#2d6a4f` (Dark) — Represents stability, sovereignty, and trust.
* **Saffron Gold:** `#d97706` (Light) / `#f59e0b` (Dark) — Represents energy, commerce, and primary actions.
* **Status Accents:**
  * **Emerald (`#10b981`):** Clean room, settled folio, verified payment, on track.
  * **Amber (`#f59e0b`):** Pending arrival, hold expiration, budget warning.
  * **Crimson (`#ef4444`):** Dirty room, overdue folio, urgent room maintenance.

### 2.2 Dual-Theme Specular Glass Tokens
```css
/* Light Mode: "Frosted Ceramic" */
.sovereign-glass-light {
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.90);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  border-left: 1px solid rgba(255, 255, 255, 0.60);
  border-right: 1px solid rgba(255, 255, 255, 0.60);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06), inset 0 1px 1px #ffffff;
  border-radius: 1.25rem;
  transform: translateZ(0);
}

/* Dark Mode: "Smoked Obsidian" */
.sovereign-glass-dark {
  background: rgba(9, 9, 11, 0.75);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.22);
  border-bottom: 1px solid rgba(0, 0, 0, 0.35);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.15);
  border-radius: 1.25rem;
  transform: translateZ(0);
}
```

---

## 3. The 0-Latency Speed Architecture (Why Current Hotel OS is Slow & The Fix)

### Current Problem:
Every click on a tab or stay triggers an uncached Server Action or RSC navigation (`router.push`). Front desk agents wait 400ms – 1,200ms looking at spinners.

### The Sovereign Fix (RAM First SWR Pipeline):
1. **Hydrate In-Memory Cache on Initial Load:**
   The entire property's active operational state (rooms, active stays, today's arrivals, housekeeping statuses, open folios) hydrates into a client-side memory store on initial load:
   ```ts
   // In-memory RAM Cache (0ms Access)
   const operationalCache = {
     stays: Map<string, StayRecord>,
     rooms: Map<string, RoomRecord>,
     timestamp: number,
   };
   ```
2. **0ms Client Filtering & Omnisearch:**
   - Typing in the search bar filters the in-memory array in **< 1ms**.
   - Switching tabs (`All Stays` $\rightarrow$ `Arrivals` $\rightarrow$ `In-House`) takes **0ms** (pure in-memory filter, zero network round-trip).
3. **Background Revalidation (SWR) & Postgres WAL Sync:**
   - Network requests run asynchronously in the background.
   - When database updates occur, Supabase Realtime pushes differential patches directly into the client RAM store, triggering instantaneous re-renders.

---

## 4. Desktop UX Standards (Linear × Stripe Benchmarks)

### 4.1 Floating Specular Topbar
- Glides over the page with `backdrop-filter: blur(24px)`.
- Contains `Ctrl+K` / `Cmd+K` global command search (instant room, guest, invoice lookup).
- Displays the active operator role pill with 4-digit PIN quick-switch.

### 4.2 The Atheros Bento Horizon Deck
Replace cluttered dashboards with modular, tactile cards featuring **live SVG circular progress rings**:
- **Ring 1: Room Occupancy Velocity** (Current % vs Target).
- **Ring 2: Revenue Pace** (Today's BTN vs Monthly Target).
- **Ring 3: Housekeeping Turnaround** (Clean vs Total).
- **Ring 4: B2B Tour Operator Credit Pool** (Credit Used vs Limit).

### 4.3 Dense Pine Spreadsheets (Data Tables)
- **Tabular Figures Law:** Every monetary figure, date, room number, and phone number MUST use `font-mono tabular-nums font-semibold` so numbers align with mathematical precision.
- **Header Actions:** Every data table automatically includes:
  - `[ 📥 Export Excel (.xlsx) ]` via `exceljs`
  - `[ 🖨️ Clean Print / PDF ]` stripped of UI chrome

---

## 5. Mobile UX Standards (Atheros Mobile Cockpit)

### 5.1 The 40/60 Thumb Rule
- **Top 40% Glanceable Deck:** Live SVG pulse ring, today's occupancy, and critical alerts.
- **Bottom 60% Thumb Cockpit:** Bottom sheets with spring drag-handles, 44px+ touch hitboxes, and one-tap quick check-in actions.

### 5.2 Swipeable Daily Pulse Cards
Horizontally flickable cards for managers and staff on smartphones:
- **Card 1: Today's Run Rate** (Occupancy, RevPAR, ADR).
- **Card 2: VIP & Tour Group Arrivals** (Soul Trips, TCB Guides).
- **Card 3: Unsettled Folios & Payment Dues**.

---

## 6. The 4-Digit Role PIN Standard (0.5s Role Switch)

Front desk terminals log in once with property credentials. Staff switch profiles in **0.5 seconds** by entering their 4-digit PIN:
- **Owner / GM PIN:** Full access to P&L, occupancy targets, staff payroll, and system settings.
- **Desk Agent PIN:** Daily operations, check-in, folio management, bill settlement. Profit margins and wholesale rates are server-redacted.
- **Housekeeping PIN:** Room cleaning status updates, maintenance photo logging. Guest bills and financial data are completely stripped.
