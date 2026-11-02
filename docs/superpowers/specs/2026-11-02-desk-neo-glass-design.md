# Desk Neo-Glass — design (2026-11-02)

Cites: `.cursor/rules/3d-glassmorphism.mdc`, `docs/architecture/3D-GLASSMORPHISM-DESIGN-SYSTEM.md`, `.cursor/skills/high-perf-glassmorphism`, `.cursor/skills/pelbu-design-system`.

## Goal

Soft-layer **Neo-Glass** (tactile neumorphism + frosted specular) for desk chrome only (`/erp`, `/staff`). Public booking (`/book`, `/`) is out of scope.

## Approach

**A — Soft layer:** add Neo-Glass utilities, map onto shadcn Card/Button inside `.erp`, wire candy-track wells onto occupancy / folio / progress gauges. Existing `.glass-*` remains; Neo-Glass extends it rather than deleting it.

## Tokens (`web/src/app/globals.css`)

Scoped under `.erp` (and staff shells that already use desk tokens):

| Token / class | Role |
|---------------|------|
| `--neo-fill`, `--neo-rim`, `--neo-shadow-out`, `--neo-shadow-in` | Extruded fill, specular rim, raised / pressed shadows |
| `.neo-card` | Frosted extruded panels & modals; specular rim; `translateZ(0)` |
| `.neo-btn` | Raised 3D control; `:active` / pressed → inset sink |
| `.neo-well` | Recessed channel for gauges |
| `.track-gradient-coral` | Dirty / unpaid / to-collect fills |
| `.track-gradient-mint` | Clean / settled / healthy occupancy |
| `.track-gradient-violet` | VIP / audit / group |

Typography on neo surfaces stays dark espresso (`--foreground`), medium+ weight, WCAG AA (≥ 4.5:1).

## In scope

1. **Cards** — `.erp [data-slot=card]` + elevated chrome already on glass (StayHub dock, Day KPI shells, glass dialogs) → `.neo-card`.
2. **Buttons** — `.erp [data-slot=button]` except `ghost` / `link` → `.neo-btn` (raised rest, inset active).
3. **Tracks** — occupancy bars (Day / FO metrics / Agent cockpit), folio balance gauges, StayHub / setup progress strips → `.neo-well` + coral/mint/violet fills.

## Out of scope (stay opaque)

- Room rack / calendar day cells, POS item grids, dense data-table body rows
- Public booking cards/CTAs
- Ghost/link buttons (density)

## A11y & perf

- `prefers-reduced-transparency`: opaque ivory / paper fill; no `backdrop-filter`
- `prefers-reduced-motion`: no press-sink motion
- No `backdrop-filter` on virtualized grids or rack cells
- Hardware compositing only on chrome (`.neo-card` / elevated panels)

## Rollout

1. CSS tokens + utilities in `globals.css`
2. Wire Card / Button defaults under `.erp`
3. Apply wells to known gauge call sites (occupancy, folio, StayHub progress)
4. Visual check Day + StayHub + calendar chrome (not rack cells)
5. Typecheck on touched files

## Non-goals

- New purple-on-white marketing kit
- Second cream/terracotta theme
- Replacing dual-tier glass rules or money/schema work
