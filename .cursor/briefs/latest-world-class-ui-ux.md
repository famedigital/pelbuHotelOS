# Cursor Brief: Neo-Spatial Glassmorphic UI/UX Master Execution

**Target:** Eliminate all flat, generic, and unpolished visuals across `v2/apps/desk` and `v2/packages/ui`. Transform Hotel OS v2 into an ultra-luxury, high-pixel, tactile, fluid operational software matching Apple VisionOS and Linear.

---

## 1. Primary Specification
- **Master Spec:** Read [`docs/v2/LATEST-WORLD-CLASS-NEO-SPATIAL-DESIGN-SPEC.md`](../../docs/v2/LATEST-WORLD-CLASS-NEO-SPATIAL-DESIGN-SPEC.md).
- **Core Visual Formula:**
  - Ambient Specular Canvas Mesh (radial light gradients behind cards).
  - Dual-tier beveled glass cards (`inset 0 1px 1px rgba(255,255,255,0.2)`).
  - Neomorphic tactile buttons with pressed spring compression (`active:scale-[0.98]`).
  - High-density tabular typography (`font-mono tabular-nums`).

---

## 2. Execution Worklist

### File 1: `v2/packages/ui/src/tokens.css`
- Add `--hos-canvas-mesh` multi-radial background gradients for both `midnight` and `light` modes.
- Add `.hos-glass-card`, `.hos-btn-tactile`, and `.hos-scrollbar-slim` utility classes.
- Ensure all borders have 1px beveled specular lighting.

### File 2: `v2/apps/desk/src/shell/App.tsx` (Executive Chrome)
- **Top Command Bar (46px):**
  - Luxury brand crest `[P] Pelbu Suites ★★★★`.
  - Search pill with `⌘K` keycap.
  - Live Till balance chip with pulsating emerald dot (`🟢 Till: Nu. 48,250.00`).
  - Gradient fast book button `⚡ Fast Book (⌘B)`.
  - Cashier avatar profile chip.
- **Sidebar Rail (210px):**
  - Category headers with `text-[9px] font-bold tracking-widest text-[var(--hos-ink-3)] uppercase`.
  - Gliding pill active indicator with Framer Motion `layoutId="activeNavPill"`.
  - Real-time notification counters (`3` arrivals, `2` dirty).
- **Mobile (<768px):**
  - Hide sidebar.
  - Render fixed bottom glass dock (58px) with 5 core tabs (Desk, Tape, Rooms, POS, More).

### File 3: `v2/apps/desk/src/modules/DeskPage.tsx` (Mission Control)
- **100vh Locked Auto-Fit:**
  - Bento KPI row (74px height) with 5 metric tiles.
  - Floor Map room strip (38px height) with color-coded interactive status chips.
  - Dual-Pane Workstation (65% / 35%):
    - Left Stay Worklist with search and VIP chips (internal 4px scrollbar only).
    - Right Operations Radar with VIP guest preferences, active tour group roster, till summary, and shift checklist.
  - Whole page NEVER scrolls on desktop!

---

## 3. Verification Commands
- `pnpm --filter @hos-v2/desk typecheck` (0 errors)
- `pnpm --filter @hos-v2/desk build` (clean production bundle)
