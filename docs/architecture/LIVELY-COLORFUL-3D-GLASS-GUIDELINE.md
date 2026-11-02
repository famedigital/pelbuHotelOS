# Lively, Colorful 3D Glassmorphism UI Guideline (Gross National Happiness Aesthetic)

> **Audience:** Cursor Composer, UI Implementers, Frontend Engineers.  
> **Mandate:** Redesign every single page, card, modal, and drawer in Hotel OS with a **joyful, warm, vibrant, and optimistic energy** ("Gross National Happiness" digital spirit) paired with cutting-edge **Apple VisionOS-style colorful 3D frosted glass**.

---

## 1. Design Philosophy: The "Lively & Happy" Energy

Hotel software is traditionally cold, clinical, and stressful. In Hotel OS, we redefine the experience:
* **The Emotion:** Welcoming, cheerful, radiant, and calm. Warm morning mountain sunlight reflecting on crystal glass.
* **The Visual Language:** Luminous translucent acrylic cards, floating 3D elevation, festive Himalayan jewel-tone glows (Marigold Gold, Paro Mint, Lapis Turquoise, Jacaranda Violet, Sunset Coral), and springy micro-interactions.
* **The Balance:** Colorful and happy does **not** mean sloppy or clownish. Numbers, guest names, and fiscal totals remain razor-sharp with enterprise contrast.

---

## 2. The 8-Color "Happiness" Chromatic Spectrum

Every status, badge, and glass border must tap into this vibrant palette. Never use dead, muddy grays.

| Color Token | Vibe & Feeling | Palette Codes (Hex) | Primary Application |
| :--- | :--- | :--- | :--- |
| **Marigold Gold** | Warmth, royalty, festive cheer | `#F59E0B` • `#FBBF24` • `rgba(245, 158, 11, 0.15)` | VIP badges, primary CTA buttons, agreed agent rates, golden-hour glows |
| **Sky Lapis / Turquoise** | Fresh mountain air, clarity | `#0284C7` • `#38BDF8` • `rgba(2, 132, 199, 0.15)` | In-house stays, direct reservations, brand accents, active tabs |
| **Paro Mint / Alpine** | Serenity, spring valleys | `#10B981` • `#34D399` • `rgba(16, 185, 129, 0.15)` | Clean room status, settled folios, positive revenue, verified payments |
| **Sunset Coral** | Celebration, dining, comfort | `#F97316` • `#FB923C` • `rgba(249, 115, 22, 0.15)` | Restaurant POS orders, chef specials, afternoon arrival badges |
| **Jacaranda Violet** | Magic, Bhutanese festivals | `#8B5CF6` • `#C084FC` • `rgba(139, 92, 246, 0.15)` | Tour group cards, SDF tax compliance badges, night audit magic |
| **Festive Crimson** | Energy, high alertness | `#EF4444` • `#F87171` • `rgba(239, 68, 68, 0.15)` | Dirty rooms, overdue folios, urgent desk alerts |
| **Pearlescent Cloud** | Crisp white Himalayan snow | `#FFFFFF` • `#F8FAFC` • `rgba(255, 255, 255, 0.85)` | Daylight glass surface base, high-contrast modal text |
| **Deep Himalayan Dusk** | Starlit mountain obsidian | `#0B0F19` • `#131B2E` • `rgba(15, 23, 42, 0.75)` | Dark-mode glass depth canvas with iridescent edge glows |

---

## 3. The 4 Ingredients of Colorful 3D Glassmorphism

Every page container, card, and modal must be built using these 4 layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. FROSTED TRANSLUCENT BASE                                            │
│    • background: rgba(255, 255, 255, 0.75) [Light] / rgba(15, 23, 42, 0.70) [Dark]
│    • backdrop-filter: blur(16px) saturate(180%)                       │
├────────────────────────────────────────────────────────────────────────┤
│ 2. PRISMATIC REFRACTION BORDER                                         │
│    • 1px border with specular gradient shine                           │
│    • border-image: linear-gradient(to bottom right, rgba(255,255,255,0.4), rgba(255,255,255,0.05))
├────────────────────────────────────────────────────────────────────────┤
│ 3. CHROMATIC AMBIENT GLOW                                              │
│    • Subtle colored shadow reflecting the status of the item           │
│    • e.g. Gold card: box-shadow: 0 20px 40px -10px rgba(245, 158, 11, 0.25) │
├────────────────────────────────────────────────────────────────────────┤
│ 4. TACTILE 3D SPRING INTERACTION                                       │
│    • hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98]       │
│    • Specular glare reflection moving on cursor hover                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Universal CSS Utility Tokens (`web/src/app/globals.css`)

Ensure these modern Tailwind classes and CSS utilities are available across the project:

```css
/* --- Ambient Chromatic Background Mesh (Cheerful & Lively) --- */
.bg-happy-mesh {
  background: 
    radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.12) 0%, transparent 40%),
    radial-gradient(circle at 90% 10%, rgba(245, 158, 11, 0.12) 0%, transparent 45%),
    radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.10) 0%, transparent 40%),
    radial-gradient(circle at 20% 90%, rgba(16, 185, 129, 0.10) 0%, transparent 45%);
}

/* --- The Master Lively 3D Glass Card --- */
.glass-happy-card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.9),
    0 12px 30px -8px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-radius: 1.25rem;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
  transform: translateZ(0);
}

.dark .glass-happy-card {
  background: rgba(15, 23, 42, 0.70);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.25),
    0 20px 40px -10px rgba(0, 0, 0, 0.5);
}

/* Colorful Glow Variations on Hover */
.glass-glow-gold:hover {
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), 0 20px 40px -10px rgba(245, 158, 11, 0.35);
  border-color: rgba(245, 158, 11, 0.5);
}

.glass-glow-mint:hover {
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), 0 20px 40px -10px rgba(16, 185, 129, 0.35);
  border-color: rgba(16, 185, 129, 0.5);
}

.glass-glow-turquoise:hover {
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), 0 20px 40px -10px rgba(2, 132, 199, 0.35);
  border-color: rgba(56, 189, 248, 0.5);
}

/* Lively Elevated Modal Sheet */
.glass-happy-modal {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 1),
    0 30px 60px -15px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border-radius: 1.5rem;
}

.dark .glass-happy-modal {
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.3),
    0 35px 70px -15px rgba(0, 0, 0, 0.7);
}
```

---

## 5. Page-by-Page & Modal-by-Modal Concrete Guidelines

### 1. Front Desk Room Calendar (`/erp/calendar`)
* **Header & Date Navigator:** Floating 3D glass bar with colorful month chips and today's business date illuminated in glowing **Sky Turquoise**.
* **Occupancy KPI Pills:** Cheerful pill badges floating at the top:
  * `Occupied: 84%` in glowing **Paro Mint**.
  * `VIPs Arriving: 4` in festive **Marigold Gold**.
  * `Dirty Rooms: 3` in energetic **Sunset Coral**.
* **Connecting Room Badges:** Joyful interlocking link icon with soft violet glow.

### 2. StayHub Master Dialog (`StayHubDialog.tsx`)
* **Outer Window:** `.glass-happy-modal` with floating spring animation on open (`scale: 0.96 -> 1`).
* **Header Capsule:** Guest name in bold obsidian/white with country flag chip, room number in glowing **Lapis** badge, and live folio balance in **Paro Mint** (`BTN 0.00`) or **Sunset Coral** (`BTN 3,200`).
* **Dual-Stream Ledger (Tab A & B):** High-contrast crisp rows separated by subtle frosted dividers. When hovering over a row, it illuminates with a soft turquoise backlight.
* **Bottom Cashier Strip:** Floating glass dock with springy, cheerful action buttons:
  * `[+ Room Charge]` (Translucent glass with white border)
  * `[Instant RMA QR]` (Glowing Marigold Gold CTA)
  * `[Check Out & Close]` (Emerald gradient pill with shine)

### 3. Arrivals, In-House, and Departures Dashboards (`/erp/arrivals`, `/erp/in-house`, `/erp/departures`)
* **Card Grid:** Replace flat tabular lists with a responsive grid of `.glass-happy-card`:
  * Left border stripe with status color (Gold for VIP arrival, Mint for in-house checked-in, Coral for departure pending payment).
  * 3D hover lift (`hover:-translate-y-1.5 hover:shadow-xl`).
  * One-tap action pills: `[Fast Check-In]` or `[View Folio]`.

### 4. Restaurant POS & Kitchen Orders (`/erp/pos`)
* **Menu Category Tabs:** Luminous pill tabs with lively food category icons (Appetizers, Bhutanese Specials, Drinks). Active tab glows in **Sunset Coral**.
* **Dish Cards:** Micro-3D glass cards with appetizing food photography, vibrant price tag (`BTN 450`), and springy `[+ Add]` bounce button.
* **Open Ticket Drawer:** Semi-translucent frosted drawer on the right with table number in bold gold and live itemized subtotal.

### 5. All Operational Modals & Confirmation Dialogs
* **Payment QR Modal:** Generates RMA Bhutan QR code embedded inside a pristine white frosted glass plinth with animated glowing border pulses.
* **Cancellation & Void Dialogs:** Instead of dull gray warnings, use a high-contrast warm modal with a **Festive Crimson** glowing badge (`Void Confirmation`), clear audit reason selection, and distinct `[Keep]` vs `[Confirm Void]` actions.

### 6. Public Guest Booking Engine (`/book`, `/`)
* **Hero Experience:** 3D interactive room explorer with Himalayan mountain peaks in the ambient background.
* **Floating Booking Pill:** Search bar floating in 3D space with date picker, room count, and a glowing gold `[Search Stays]` button with ambient particle sparkles.
* **Room Showcase Cards:** 3D tilt cards with room amenities displayed as happy, colorful glass chips (Free Wi-Fi, Mountain View, Fireplace, Breakfast Included).

### 7. Lively & Colorful 3D Glass Data Tables (`.glass-happy-table`)
Tables in Hotel OS must never feel like boring, flat spreadsheets. They must look like luminous floating crystals with vibrant row illumination:

* **Floating Acrylic Table Shell (`.glass-happy-table`):**
  - Rounded container (`rounded-2xl`) wrapped in frosted glass with a specular top rim and 1px refraction border.
  - Floating header (`<thead>`): Semi-translucent with subtle Himalayan pastel tint, uppercase micro-typography, and glowing sort arrows.
* **Luminous Frosted Rows (`<tbody> <tr>`):**
  - Alternating subtle glass tiers (`odd:bg-white/5 even:bg-white/[0.02]` in dark mode).
  - **Chromatic Row Illumination on Hover:**
    - When hovering a row, it slides right (`hover:translate-x-1`), illuminates with a soft status-tinted backlight, and gains a specular border.
    - VIP / Agent row hover $\rightarrow$ Soft **Marigold Gold** ambient glow (`rgba(245, 158, 11, 0.12)`).
    - In-House stay row hover $\rightarrow$ Radiant **Sky Turquoise** ambient glow (`rgba(2, 132, 199, 0.12)`).
    - Settled / Paid folio row hover $\rightarrow$ Fresh **Paro Mint** glow (`rgba(16, 185, 129, 0.12)`).
    - Dirty / Due out row hover $\rightarrow$ Energetic **Sunset Coral** glow (`rgba(249, 115, 22, 0.12)`).
* **High-Contrast Data Cells (`<td>`):**
  - Numbers, monetary amounts, and invoice IDs formatted in crisp tabular numerals (`font-mono tabular-nums font-semibold`).
  - Status cells use **Glowing Pill Badges**:
    ```tsx
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold glass-badge-clean">
      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Settled & Paid
    </span>
    ```
* **Floating Glass Pagination Dock:**
  - Pinned below the table as a floating frosted pill with cheerful springy page jump buttons (`[1]`, `[2]`, `[3]`), showing total record counts in joyful copy (*"Showing 15 happy stays out of 42"*).

```css
/* --- Master 3D Glass Data Table Utility --- */
.glass-happy-table-container {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.9),
    0 15px 35px -10px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-radius: 1.25rem;
  overflow: hidden;
  transform: translateZ(0);
}

.dark .glass-happy-table-container {
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.2),
    0 25px 50px -15px rgba(0, 0, 0, 0.6);
}

/* Row Hover Spring & Chromatic Backlight */
.glass-table-row {
  transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease, box-shadow 0.15s ease;
}

.glass-table-row:hover {
  transform: translateX(4px);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 2px 0 0 0 #0284C7, 0 4px 15px rgba(2, 132, 199, 0.12);
}

.dark .glass-table-row:hover {
  background: rgba(30, 41, 59, 0.75);
  box-shadow: inset 3px 0 0 0 #38BDF8, 0 8px 25px rgba(56, 189, 248, 0.18);
}
```

---

## 6. Cheerful Micro-Interactions & Audio-Visual Polish

1. **Springy Button Presses:**
   ```tsx
   <button className="touch-press rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 font-medium text-white shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 active:scale-95">
     Fast Check-In ✨
   </button>
   ```
2. **Celebratory Feedback:**
   When check-in or checkout completes, trigger a cheerful Sonner toast with an animated icon:
   ```ts
   toast.success("Guest Checked-in Successfully!", {
     description: "Room 204 keys active • Welcome drink dispatched.",
     className: "glass-happy-card border-emerald-500/30 text-emerald-600",
   });
   ```
3. **Empty States with Happiness:**
   Never show a blank white page. Show warm, friendly empty states with custom hotel illustrations and cheerful copy (e.g. *"All rooms are clean and sparkling! Take a breath of fresh Paro air."*).

---

## 7. Cursor Execution Instructions

Feed this exact prompt to Cursor:

> *"Redesign the entire UI to follow the lively, colorful 3D glassmorphism guidelines in [`docs/architecture/LIVELY-COLORFUL-3D-GLASS-GUIDELINE.md`](file:///c:/GitHub/Hotel%20OS%20Bhutan/docs/architecture/LIVELY-COLORFUL-3D-GLASS-GUIDELINE.md). Apply `.glass-happy-card`, `.glass-happy-modal`, the 8-color Himalayan happiness palette, and springy micro-interactions to all pages, cards, and modals across `/erp`, `/staff`, and `/book`. Verify with `pnpm --dir web run typecheck`."*
