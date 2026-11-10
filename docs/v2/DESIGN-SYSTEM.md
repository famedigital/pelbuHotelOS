# Hotel OS v2 — UI/UX Design System v2.1 ("Glacier Glass")

> **Audience:** Cursor + GLM implementers building under top-level `v2/`.
> **Scope:** `v2/packages/ui`, `v2/apps/desk`, `v2/apps/web`. Does **not** restyle Innora `web/`.
> **Status:** Canonical for the clean `v2/` product. Root Wave `apps/*` Alpine tokens are non-canonical.
> Companion: [UX-GUARDRAILS.md](./UX-GUARDRAILS.md) · [MODULES.md](./MODULES.md)

Superseded for history only:
[`3D-GLASSMORPHISM-DESIGN-SYSTEM.md`](../architecture/3D-GLASSMORPHISM-DESIGN-SYSTEM.md) ·
prior "Alpine Glass" Wave notes.

---

## 0. Glacier Glass (v2.1 visual direction)

From owner reference: premium blue & white glassmorphism dashboard.

| Token | Value | Use |
|---|---|---|
| `--hos-canvas` | `#F5F8FF` → `#E8F0FF` mesh | L0 base + radial blobs `#60A5FA` 10%, `#A5B4FC` 8% |
| `--hos-primary` | `#2563EB` | Primary accent (electric blue) |
| `--hos-primary-grad` | `#3B82F6 → #2563EB` | Primary buttons, chart areas |
| `--hos-primary-glow` | `0 8px 24px -6px rgba(37,99,235,.45)` | Hover/focus glow |
| `--hos-brass` | `#F59E0B` / ink `#B45309` | **Secondary only** — VIP, agreed rate, premium badges |
| Status | Emerald `#10B981`, Lapis `#3B82F6`, Ruby `#EF4444`, Teal groups | Same semantic roles as before |
| Dark "Midnight Glass" | `#0B1220` base, intensified blue glow | Opt-in desk dark; **KDS always dark** |

White text on `#2563EB` ≈ 5.17:1 (AA ✓).

**Styling engine for `v2/`:** Tailwind CSS v4 with design tokens as CSS variables (`@theme`), plus Radix/shadcn-style locals. Root Wave desk (no Tailwind) is frozen reference — do not extend it.

---

## 1. Principles (priority order)

1. **Legibility beats atmosphere.** Numbers, room numbers, guest names, money — readable at 1 m under glare.
2. **Glass is chrome; data is ceramic.** Shell/header/drawers/docks = glass. Table cells, rack cells, folio lines, inputs, keypads = **opaque**.
3. **Motion explains state**, never decorates. Springs for interaction; fixed duration only for opacity/color.
4. **Instant feedback, honest settlement.** Press < 16 ms. **Money never optimistic** — pending until API ack.
5. **One primary accent.** Electric blue is the CTA. Brass/gold is secondary. Status colours for status only.
6. **Thin-page ban.** No mock rows; empty states have one primary action ([UX-GUARDRAILS](./UX-GUARDRAILS.md)).

---

## 2. Spatial depth

```
L3  FLOAT     palette, toasts, popovers     blur 28 · α .86
L2  SHEET     StayHub, Fast Book, PIN       blur 20 · α .82
L1  PANEL     header, rail, KPI cards       blur 12 · α .72
L0  CANVAS    sky-blue mesh                 no blur
DATA          cells / rows / folio / inputs OPAQUE — no backdrop-filter
```

- Max **3** backdrop-filtered layers stacked.
- Never blur repeated rows/cells.
- `transform: translateZ(0)` on glass for GPU compositing.
- Respect `prefers-reduced-motion` and `prefers-reduced-transparency` (solid fallbacks).
- **L0 still water** (`StillWaterSurface`, opt-in via `GlassShell stillWater`): **Off by default on desk** (60fps FO). When enabled: transparent when calm, local directional wake, lazy WebGL, ≤30fps, half-res, auto-disable on frame budget. Fine pointer only; never on racks/tables/POS/KDS.

---

## 3. Analytics cards

KPI tiles: odometer number, mini sparkline, delta chip (▲ 12% vs last week), soft blue area charts (ECharts or visx wrapper in `v2/packages/ui/charts`). Hover tooltip on glass.

---

## 4. Motion

- Hover lift (−2 px) + primary glow
- Card stagger on load (30 ms)
- Shared-element list → StayHub drawer
- Spring physics; interruptible
- L0 still-water mesh wake (see spatial depth note above)

---

## 5. Breakpoints (per module)

| Surface | Phone 390 | Tablet 768 | Desk 1280+ |
|---|---|---|---|
| FO Desk / Reservations | agenda cards + bottom-sheet StayHub | split list + sheet | full + 420px StayHub |
| StayView | 7-day agenda | 7-day rack | full rack |
| POS | — | tablet-first | tablet |
| KDS | — | wall dark | wall dark, no glass |
| HK / Laundry / Staff | mobile-first | ok | ok |
| Owner | phone-first | ok | ok |

---

## 6. Component kit (Phase 2+)

Must exist in `v2/packages/ui` before Wave modules ship UI:

- Data table (search, filters, saved views, group-by, multi-select, export)
- Command bar (`cmdk`)
- Drawer / bottom sheet (`vaul`)
- Undo toast (`sonner`) — non-money only
- Confirm card + manager-PIN popover — money
- PIN pad, TactileButton, Odometer (COPY from Wave UI shells)

---

## 7. Accessibility

- WCAG 2.1 AA (≥ 4.5:1) on all text on glass
- i18next EN + Dzongkha
- No purple as brand (groups = Teal)
