# Hotel OS v2: The Definitive Neo-Spatial & Glassmorphic UI/UX Master Specification

> **Design Philosophy:** **"Apple VisionOS Spatial Depth × Linear High-Density Precision × Bloomberg Financial Terminal Legibility."**  
> **Target:** Eliminate all flat, generic, and unpolished visuals. Transform Hotel OS v2 into an ultra-luxury, high-pixel, tactile, fluid operational powerhouse.

---

## 1. Visual Architecture: The 4 Spatial Layers

To achieve true high-class luxury, the interface operates on **4 physical depth layers** governed by optics, specular lighting, and refraction:

```
┌────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: FLOATING POP-OVERS, SHEETS & MODALS (Z: 50–90)                │
│ • FastBook Studio, StayHub Drawer, Department Print Studio             │
│ • Blur: 24px, Specular Rim: 1px rgba(255,255,255,0.22), Ambient Drop:  │
│   0 24px 64px -12px rgba(0,0,0,0.55), Beveled Hairline Edge           │
├────────────────────────────────────────────────────────────────────────┤
│ LAYER 2: INTERACTIVE NEOMORPHIC CONTROLS & BENTO TILES (Z: 10–20)      │
│ • Bento KPI Cards, Room Matrix Chips, Morphing Tabs, Action Dock       │
│ • Blur: 14px, Inset Top Highlight: 1px rgba(255,255,255,0.15),         │
│   Pressed compression: active:scale-[0.98], subtle chromatic glow      │
├────────────────────────────────────────────────────────────────────────┤
│ LAYER 1: STRUCTURAL GLASS CHROME & RAILS (Z: 1–5)                      │
│ • 46px Executive Header, 210px Floating Sidebar, Sticky Table Headers  │
│ • Blur: 16px, Border: 1px solid var(--hos-glass-border), High Contrast│
├────────────────────────────────────────────────────────────────────────┤
│ LAYER 0: ATMOSPHERIC AMBIENT CANVAS (Z: 0)                             │
│ • Obsidian Void (#070B12) or Glacier Ceramic (#F8FAFC)                 │
│ • Multi-radial chromatic light mesh (Sapphire, Emerald, Gold glow)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Optical Formula (CSS Lighting & Tokens)

### A. Ambient Light Canvas Mesh
Instead of a flat background, the canvas radiates atmospheric specular light:

```css
/* Ambient Chromatic Canvas Mesh */
[data-theme="midnight"], .dark {
  --hos-canvas: #070B12;
  --hos-canvas-mesh: 
    radial-gradient(circle at 10% 15%, rgba(59, 130, 246, 0.08) 0%, transparent 45%),
    radial-gradient(circle at 85% 20%, rgba(245, 158, 11, 0.06) 0%, transparent 40%),
    radial-gradient(circle at 50% 90%, rgba(16, 185, 129, 0.05) 0%, transparent 50%),
    #070B12;
}

[data-theme="light"] {
  --hos-canvas: #F8FAFC;
  --hos-canvas-mesh: 
    radial-gradient(circle at 15% 15%, rgba(59, 130, 246, 0.05) 0%, transparent 45%),
    radial-gradient(circle at 85% 85%, rgba(245, 158, 11, 0.04) 0%, transparent 40%),
    #F8FAFC;
}
```

### B. Dual-Tier Specular Glass Borders
True glass has light reflecting along its upper beveled rim:

```css
/* High-End Specular Glass Class */
.hos-glass-card {
  background: var(--hos-surface);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--hos-glass-border);
  box-shadow: 
    /* Specular top rim light */
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.16),
    /* Soft ambient elevation */
    0 10px 30px -8px rgba(0, 0, 0, 0.35);
  border-radius: 14px;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
}

.hos-glass-card:hover {
  border-color: rgba(59, 130, 246, 0.35);
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.25),
    0 14px 40px -10px rgba(0, 0, 0, 0.45),
    0 0 24px -6px rgba(59, 130, 246, 0.25);
}
```

### C. Neomorphic Tactile Physics for Buttons & Inputs
Physical buttons must feel **springy, tactile, and clickable**:

```css
.hos-btn-tactile {
  box-shadow: 
    inset 0 1px 0 0 rgba(255, 255, 255, 0.22),
    0 2px 6px -1px rgba(0, 0, 0, 0.25);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.hos-btn-tactile:active {
  transform: scale(0.98) translateY(1px);
  box-shadow: 
    inset 0 2px 4px 0 rgba(0, 0, 0, 0.35),
    0 1px 2px 0 rgba(0, 0, 0, 0.1);
}
```

---

## 3. High-Pixel Financial Typography System

1. **Tabular Numerics Everywhere:**
   - All monetary figures (`Nu. 142,500`), percentages (`78%`), room numbers (`102`), and dates use `font-mono tabular-nums tracking-tight` with `font-feature-settings: 'tnum', 'zero'`.
2. **Micro-Hierarchy Ramps:**
   - **Hero Value:** `text-2xl font-black tracking-tight text-[var(--hos-ink)]`
   - **Section Header:** `text-xs font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]`
   - **Status Badge:** `text-[10px] font-bold px-2 py-0.5 rounded-full border`
   - **Keycap Badges (`⌘K`, `⌘B`):** Styled like mechanical keyboard switches: `rounded-md border border-[var(--hos-line)] bg-[var(--hos-cell)] px-1.5 py-0.5 text-[9px] font-mono font-bold shadow-[0_1px_2px_rgba(0,0,0,0.15)]`.

---

## 4. Master Screen Blueprints

### Blueprint 1: The Executive Glass Shell (`App.tsx`)
- **46px Razor-Thin Specular Header:**
  - Left: Luxury Crest (`[P] Pelbu Suites ★★★★` with golden crown emblem) + property indicator.
  - Center: Global Command search pill (`🔍 Search reservation, guest, room # ⌘K`).
  - Right: Live Bhutanese Business Date (`📅 08 Nov · Shift 1`), Till Balance chip (`🟢 Till: Nu. 48,250.00`), Passes Studio shortcut, `⚡ Fast Book (⌘B)` gradient button, and Staff PIN avatar.
- **210px Floating Glass Sidebar Rail:**
  - Compact `p-2` padding with sleek category dividers (`FRONT OFFICE`, `ROOMS`, `F&B`, `SALES`, `FINANCE`).
  - Fluid gliding pill indicator (`layoutId="activeNavPill"`) with soft sapphire/emerald ambient glow.
  - Live notification counters (`3` arrivals left on Desk, `2` dirty rooms on Housekeeping).

### Blueprint 2: Desk Mission Control (`DeskPage.tsx`)
- **Top Bento Executive Ribbon (5 Cards · 74px height):**
  1. **Occupancy Tonight:** Large bold `78%`, micro progress bar, `18/24 Rooms`, delta pill `+12%`.
  2. **Daily Yield / RevPAR:** `Nu. 142,500`, ADR `Nu. 7,916`, 10% SC included.
  3. **Arrivals Flight:** `8 Arrivals Today` (`3 In-House · 5 En-Route`), unassigned room alert.
  4. **Departures Check:** `6 Departures Today` (`4 Checked-Out · 2 Pending Settlement`).
  5. **Room Readiness:** HK status chips (`19 Clean Ready · 3 In-Progress · 2 Dirty · 0 OOO`).
- **Mini Floor Map Quick Strip (38px height):**
  - Interactive room chips for Floor 1, Floor 2, Floor 3 with live color-coded status (Clean, Occupied, Dirty, Arriving, OOO). Clicking any room opens its stay drawer or inspection.
- **Two-Column Workstation (65% / 35% · 100vh Auto-Fit):**
  - **Left Worklist (65%):** Tabbed list (Arrivals, In-House, Departures, Tomorrow) with search, VIP filter pill, and luxury guest cards with 1-tap `⚡ Check In & Keycard` and `Check Out`.
  - **Right Operations Radar (35%):** VIP guest radar with stay preferences, active tour group roster, cashier till summary, and shift checklist.
  - **Zero Whole-Page Scrolling:** Only the internal guest list scrolls with a slim 4px scrollbar.

### Blueprint 3: FastBook Studio (`FastBookModal.tsx`)
- **Centering Obsidian Glass Modal:**
  - Specular beveled rim lighting, status summary ribbon, rooms count stepper (`− 1 +`), adults stepper (`− 2 +`), children stepper (`− 0 +`), rollaway extra bed switch (`+ Nu. 1,500/night`).
  - Interactive visual room category cards with live vacant room counters (`5 free`) and base rates.
  - DRC Form BST-3 Quotation Bento displaying Base Net, Meals & Extras, 10% SC Tip Pool, 10% Bhutan BST, and Grand Total.

### Blueprint 4: StayHub Drawer (`StayHubDrawer.tsx`)
- **Dual-Folio Engine:** Master (Agency MoU) vs Personal (Guest Incidentals) streams.
- **Night-by-Night Daily Rate & Meal Matrix:** Every stay night has its own editable base rate, meal plan buttons (`EP`, `CP`, `MAP`, `AP`), extra bed toggle, and **"Copy N1 to all ↷"** 1-tap bulk sync.

---

## 5. Mobile & Tablet Level 0-to-100 Handheld Suite (<768px)

1. **Hide Desktop Sidebar:** Sidebar is hidden on phones (`hidden md:flex`).
2. **Fixed Bottom Glass Navigation Dock (58px + safe area):**
   - 🏨 **Desk** (`/desk`), 📊 **StayView** (`/stayview`), 🛏️ **Rooms** (`/housekeeping`), 🍽️ **POS** (`/pos`), ☰ **More** (opens full-screen slide-over sheet of all 31 modules).
3. **Native iOS Bottom Sheet for FastBook & StayHub (`vaul`):**
   - Slides up from bottom with top drag handle, swipe-to-dismiss gesture, and thumb-friendly controls.
4. **Mobile StayView Day Carousel:**
   - Switches from wide table to a horizontal swipeable Date Carousel (`[Today 08] [Thu 09] [Fri 10]...`) with room cards for the selected date.
5. **Hallway Housekeeping Mode:**
   - Large tactile cards with 1-tap `[Mark Clean]`, `[Mark Dirty]`, `[Inspect]`.
