# DesignMotionHQ / UX Engine Architecture & Patterns for Hotel OS Bhutan

> **Origin:** Synthesis of DesignMotionHQ (`https://designmotionhq.com/`), UX Engine, and modern senior-designer interaction mechanics (Linear, Atheros, Emil Kowalski motion principles).
> **Objective:** Permanently eliminate generic "AI-generated" UI anti-patterns, sluggish tables, and unusable mobile layouts across all Hotel OS Bhutan workspaces.

---

## 1. Why AI-Generated UIs Look Amateurish (And What We Ban)

| AI Anti-Pattern | Why It Fails | UX Engine Replacement |
|---|---|---|
| **Generic Purple/Indigo Gradients** | Looks like a cookie-cutter SaaS template from 2022. | **Himalayan Jewel Tokens:** Saffron Gold (`#d97706`), Pine Green (`#059669`), Lapis (`#2563eb`), Coral (`#e11d48`). |
| **Squished Desktop Tables on Mobile** | 8 columns crammed into 375px with tiny 9px unreadable font or infinite horizontal scroll trap. | **The Six Moves Restructuring:** Decompose table rows into touch-first stacked cards with primary anchors. |
| **Loading Spinners on Search/Filter** | Triggering network roundtrips on every keystroke causes stutter and lag. | **Reverse-Engineered Linear:** RAM-first client filtering (< 2ms CPU execution) with optimistic UI updates. |
| **Hidden Hover Traps** | Putting essential actions inside `:hover` renders them invisible or un-tappable on iPad/mobile. | **Persistent Touch Targets:** 44px minimum tap targets placed ergonomically in the thumb zone. |
| **Shallow Modals for Complex Work** | Cramming folios, billing lines, and forms into a tiny fixed popup. | **Fluid Drawer / Split-Screen Workspaces:** Edge-to-edge spatial panels with high-contrast legibility. |

---

## 2. The Six Moves: Mobile Table Restructuring (< 640px)

When a table doesn't fit a phone, shrinking the font is not the fix. UX Engine uses **Six Structural Moves**:

```
Desktop Wide Table:
[ Room ] [ Guest Name ] [ Pax ] [ Plan ] [ Due Nu ] [ Guide ] [ Status ] [ Actions ]

            ⬇  THE SIX MOVES RESTUCTURING  ⬇

Mobile / Tablet Touch Card:
┌────────────────────────────────────────────────────────┐
│ [Move 1: Primary Anchor]       [Move 2: Status Pill]   │
│ ROOM 102                      🟢 Clean • Due In Today │
│ Guest: Karma Dorji • 2 Pax    Plan: MAP (Half Board)  │
├────────────────────────────────────────────────────────┤
│ [Move 3: Quick Metadata]                               │
│ Nu. 4,500 Due • Soul Trips Bhutan (Guide: Tashi)       │
├────────────────────────────────────────────────────────┤
│ [Move 4: Thumb-Zone Fast Action]    [Move 5: Details]  │
│ [⚡ 1-Tap Check-In] (Green 44px)     [Drawer Hub >]     │
└────────────────────────────────────────────────────────┘
```

1. **Move 1: Primary Anchor Isolation**
   - Isolate the single most critical operational identifier (e.g. `Room 102` or `INV-2026-0042`) in large 18px+ font.
2. **Move 2: Stacked Badge Decomposition**
   - Convert secondary columns (Meal Plan, Status, Occupancy) into concise inline jewel pills.
3. **Move 3: Sticky Horizontal Horizon**
   - Anchor swipeable filter pills (`[All]`, `[Priority Dirty]`, `[Stayovers]`, `[Clean]`) at the top under the header with zero layout shift.
4. **Move 4: Thumb-Zone Primary Mutation**
   - Place the most common action (`[1-Tap Check-In]`, `[Tap Clean]`, `[Charge Folio]`) as a large button in the bottom 40% thumb reach area.
5. **Move 5: Progressive Disclosure Drawers**
   - Detailed billing lines, tax calculations, and notes live in a native sliding bottom drawer (`100dvh`), avoiding horizontal table overflow.
6. **Move 6: Tactile Micro-Spring Depress**
   - Add `active:scale-[0.98]` with instantaneous visual response so staff feel immediate physical confirmation when tapping buttons.

---

## 3. Reverse-Engineered Linear Speed Mechanics

To achieve 60 FPS fluidity and zero input lag:
- **Instant RAM Filtering:** Data loaded on page load is filtered in browser CPU memory (`useMemo`) in `< 2ms`. Keystrokes never touch the network for search or status pills.
- **Optimistic State Swapping:** Clicking `[✨ Tap Clean]` or `[⚡ 1-Tap Check-In]` flips the UI badge instantly, while the atomic server mutation executes seamlessly in the background.
- **Hairline Spatial Borders:** Replace heavy drop shadows with delicate translucent specular borders:
  ```css
  border: 1px solid rgba(255, 255, 255, 0.12); /* Dark theme */
  border: 1px solid rgba(0, 0, 0, 0.08);       /* Light theme */
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.25);
  ```

---

## 4. Contextual Floating Bulk Action Dock

When staff select multiple rows (e.g. 5 dirty rooms or 3 arrivals), a floating glass dock glides up from the bottom safe area:

```html
<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl sovereign-glass border border-white/20 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
  <span class="text-xs font-bold text-foreground">3 Rooms Selected</span>
  <div class="h-4 w-px bg-border" />
  <button class="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-500">
    Mark Clean
  </button>
  <button class="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-sm">
    Print Passes
  </button>
</div>
```

---

## 5. Summary of Built Components Leveraging These Principles

1. **`UniversalAgentDossierView.tsx`**: 0-latency RAM filtering, bento credit health gauge, 1-click export, eliminating multi-page jumping.
2. **`GlanceableKitchenBoard.tsx`**: High-contrast 20px+ readable clock and headcount bento deck with live elapsed-time KOT alert badges.
3. **`GlanceableHousekeepingBoard.tsx`**: Visual floor turnaround grid with optimistic 1-tap `[✨ Tap Clean]`.
4. **`QuickRoomChargeModal.tsx` & `QuickBhutanQrModal.tsx`**: Instant touch-first search and settle modals designed for high-throughput restaurant terminals.
5. **`MobileDayAgenda.tsx`**: 7-day horizontal swipeable date pill bar with tactile touch cards restructuring the calendar for phones.
