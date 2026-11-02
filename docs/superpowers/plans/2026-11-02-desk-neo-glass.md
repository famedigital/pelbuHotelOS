# Desk Neo-Glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft-layer Neo-Glass (tactile neumorphism + frosted specular) on desk chrome only — cards, buttons, and candy-track status wells under `.erp` / staff desk shells.

**Architecture:** Add CSS tokens/utilities in `globals.css`, then scope Card/Button remaps and gauge wells to desk surfaces. Rack cells, POS grids, and dense table bodies stay opaque. Existing `.glass-*` classes remain; Neo-Glass extends them.

**Tech Stack:** Next.js 16 / React 19, Tailwind + shadcn `Card`/`Button`, `web/src/app/globals.css`, desk shell `.erp`.

## Global Constraints

- Desk only (`/erp`, `/staff`); `/book` and marketing out of scope
- No `backdrop-filter` on rack cells, calendar day cells, POS item grids, or dense table rows
- Typography on neo surfaces: dark espresso `--foreground`, WCAG AA ≥ 4.5:1
- Honor `prefers-reduced-transparency` and `prefers-reduced-motion`
- Do not invent a purple marketing kit or a second cream/terracotta theme
- Commits only when the user explicitly asks (repo user rule)

---

### Task 1: Neo-Glass CSS tokens and utilities

**Files:**
- Modify: `web/src/app/globals.css` (after existing `.glass-happy-*` block ~1688–1760; also extend reduced-transparency / reduced-motion blocks ~1880–1915)
- Spec: `docs/superpowers/specs/2026-11-02-desk-neo-glass-design.md`

**Interfaces:**
- Consumes: existing `--glass-*`, `--foreground`, desk ivory tokens
- Produces: `.neo-card`, `.neo-btn`, `.neo-well`, `.track-gradient-coral|mint|violet`, CSS vars `--neo-*`

- [ ] **Step 1: Append Neo-Glass token block to `globals.css`**

Insert after the `.glass-happy-card` / glow section (before dock styles is fine):

```css
/* --- Desk Neo-Glass (tactile neumorphism + frosted specular) --- */
.erp {
  --neo-fill: rgba(255, 255, 255, 0.82);
  --neo-rim: rgba(255, 255, 255, 0.72);
  --neo-text: var(--foreground);
  --neo-shadow-out:
    6px 6px 14px rgba(26, 20, 16, 0.1),
    -4px -4px 12px rgba(255, 255, 255, 0.85);
  --neo-shadow-in:
    inset 4px 4px 10px rgba(26, 20, 16, 0.12),
    inset -3px -3px 8px rgba(255, 255, 255, 0.75);
  --neo-specular: inset 0 1px 1px rgba(255, 255, 255, 0.9);
  --neo-blur: 14px;
}

.dark .erp,
.erp.dark,
.fo-command {
  --neo-fill: rgba(18, 22, 28, 0.78);
  --neo-rim: rgba(255, 255, 255, 0.12);
  --neo-shadow-out:
    6px 6px 16px rgba(0, 0, 0, 0.45),
    -3px -3px 10px rgba(255, 255, 255, 0.04);
  --neo-shadow-in:
    inset 4px 4px 12px rgba(0, 0, 0, 0.55),
    inset -2px -2px 8px rgba(255, 255, 255, 0.06);
  --neo-specular: inset 0 1px 1px rgba(255, 255, 255, 0.18);
}

.neo-card {
  background: var(--neo-fill);
  color: var(--neo-text);
  border: 1px solid var(--neo-rim);
  border-radius: 1.125rem;
  box-shadow: var(--neo-specular), var(--neo-shadow-out);
  backdrop-filter: blur(var(--neo-blur)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--neo-blur)) saturate(160%);
  transform: translateZ(0);
  font-weight: 500;
}

.neo-btn {
  box-shadow: var(--neo-specular), var(--neo-shadow-out);
  border-color: color-mix(in oklab, var(--neo-rim) 80%, transparent);
  transform: translateZ(0);
  transition:
    box-shadow 0.15s ease,
    transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

.neo-btn:active,
.neo-btn[data-pressed="true"] {
  box-shadow: var(--neo-shadow-in);
  transform: translateY(1px) translateZ(0);
}

.neo-well {
  overflow: hidden;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--neo-fill) 55%, rgba(26, 20, 16, 0.08));
  box-shadow: var(--neo-shadow-in);
  transform: translateZ(0);
}

.track-gradient-coral {
  background: linear-gradient(90deg, #fb7185 0%, #ef4444 55%, #f59e0b 100%);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.35);
}

.track-gradient-mint {
  background: linear-gradient(90deg, #34d399 0%, #10b981 55%, #2dd4bf 100%);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.35);
}

.track-gradient-violet {
  background: linear-gradient(90deg, #a78bfa 0%, #8b5cf6 50%, #6366f1 100%);
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.35);
}

/* Soft remap: desk cards / non-flat buttons pick up Neo-Glass */
.erp [data-slot="card"]:not([data-neo="off"]) {
  background: var(--neo-fill);
  color: var(--neo-text);
  border: 1px solid var(--neo-rim);
  box-shadow: var(--neo-specular), var(--neo-shadow-out);
  backdrop-filter: blur(var(--neo-blur)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--neo-blur)) saturate(160%);
  transform: translateZ(0);
}

.erp [data-slot="button"]:not([data-variant="ghost"]):not([data-variant="link"]):not([data-neo="off"]) {
  box-shadow: var(--neo-specular), var(--neo-shadow-out);
  transform: translateZ(0);
  transition:
    box-shadow 0.15s ease,
    transform 0.12s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.15s ease,
    color 0.15s ease;
}

.erp [data-slot="button"]:not([data-variant="ghost"]):not([data-variant="link"]):not([data-neo="off"]):active {
  box-shadow: var(--neo-shadow-in);
  transform: translateY(1px) translateZ(0);
}
```

- [ ] **Step 2: Extend a11y fallbacks**

In the existing `@media (prefers-reduced-transparency: reduce)` block, add `.neo-card` and the card remap selector to the opaque list. In `@media (prefers-reduced-motion: reduce)`, disable `.neo-btn` / button remap active transform:

```css
@media (prefers-reduced-transparency: reduce) {
  .neo-card,
  .erp [data-slot="card"]:not([data-neo="off"]) {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: var(--paper-0, #fff) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .neo-btn,
  .erp [data-slot="button"]:not([data-variant="ghost"]):not([data-variant="link"]) {
    transition: none !important;
  }
  .neo-btn:active,
  .erp [data-slot="button"]:not([data-variant="ghost"]):not([data-variant="link"]):active {
    transform: none !important;
  }
}
```

- [ ] **Step 3: Verify CSS loads**

Run: open `http://localhost:3000/erp/day` (dev server). In DevTools on a card, confirm `--neo-fill` resolves under `.erp`.

Expected: computed `--neo-fill` is a non-empty rgba string.

- [ ] **Step 4: Commit only if user asked**

Do not commit unless the user explicitly requests a commit.

---

### Task 2: Button variant attribute for Neo-Glass opt-out

**Files:**
- Modify: `web/src/components/ui/button.tsx`
- Consumes: Task 1 CSS selectors that use `[data-variant=…]`
- Produces: `data-variant` on every Button for CSS filtering of ghost/link

**Interfaces:**
- Consumes: `buttonVariants` / `VariantProps`
- Produces: `data-variant={variant ?? "default"}` on the rendered element

- [ ] **Step 1: Set `data-variant` on Button**

In `web/src/components/ui/button.tsx`, update the render to:

```tsx
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
```

- [ ] **Step 2: Sanity check**

Confirm ghost buttons in Day toolbar stay flat (no extruded shadow). Primary "Check in all" / StayHub "Settle & Check-out" show raised shadow and sink on click.

- [ ] **Step 3: Commit only if user asked**

---

### Task 3: Wire candy-track wells on desk gauges

**Files:**
- Modify: `web/src/components/erp/FoCommandDesk.tsx` (~lines 62–67 `FoMetricCard` bar)
- Modify: `web/src/components/erp/AgentCockpitBoard.tsx` (~lines 183–189 figure bars)
- Modify: `web/src/components/erp/setup/PropertySetupModalShell.tsx` (~line 81 progress bar)
- Modify: `web/src/components/erp/stay-hub/StayHubCashierDock.tsx` (add folio due gauge above settle row)
- Modify: `web/src/components/erp/RoomRackGrid.tsx` occupancy popover fill only (~2207–2211) — chrome popover, not rack cells

**Interfaces:**
- Consumes: `.neo-well`, `.track-gradient-coral|mint|violet`
- Produces: gauge markup using those classes; coral = warn/unpaid/high stress, mint = healthy/settled, violet = VIP/audit-ish secondary

- [ ] **Step 1: FoCommandDesk metric bar**

Replace the percent track in `FoMetricCard`:

```tsx
      {percent != null ? (
        <div className="neo-well mt-3 h-1.5">
          <div
            className={cn(
              "h-full rounded-full",
              barClassName ?? "track-gradient-mint",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
```

Where callers pass warn/dirty tones, pass `barClassName="track-gradient-coral"`; occupancy healthy stays mint; group/VIP hints use violet.

- [ ] **Step 2: AgentCockpitBoard figure bars**

```tsx
            {figure.bar != null ? (
              <div className="neo-well mt-2 h-1.5">
                <div
                  className={cn(
                    "h-full rounded-full",
                    figure.warn ? "track-gradient-coral" : "track-gradient-mint",
                  )}
                  style={{ width: `${figure.bar}%` }}
                />
              </div>
            ) : null}
```

- [ ] **Step 3: PropertySetupModalShell progress**

```tsx
            <div className="neo-well mb-3 h-1.5">
              <div
                className="h-full rounded-full track-gradient-violet"
                style={{ width: `${percent}%` }}
              />
            </div>
```

(Use the existing percent variable name in that file.)

- [ ] **Step 4: StayHubCashierDock folio due well**

Above the guest-stream row, add a settled/due track (0–100 clamped from clear vs due — when clear show full mint; when due show coral fill at `Math.min(100, …)` or a simple 100% coral bar when unpaid):

```tsx
      <div className="neo-well h-1.5" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full",
            clear ? "track-gradient-mint" : "track-gradient-coral",
          )}
          style={{ width: clear ? "100%" : "100%" }}
        />
      </div>
```

(Full-width status track is intentional: binary clear vs due, not a fake %)

- [ ] **Step 5: Room rack Occ popover fill only**

In the month-stat popover bottom strip (~2207), keep card opaque; only the fill uses tracks:

```tsx
                    <div className="neo-well absolute inset-x-0 bottom-0 h-0.5 rounded-none">
                      <div
                        className={cn(
                          "h-full",
                          stat.percent >= 80
                            ? "track-gradient-coral"
                            : stat.percent >= 50
                              ? "track-gradient-violet"
                              : "track-gradient-mint",
                        )}
                        style={{ width: `${stat.percent}%` }}
                      />
                    </div>
```

Do **not** add blur/neo-card to rack timeline cells.

- [ ] **Step 6: Visual verify**

Browse `/erp/day`, open StayHub on an in-house stay, `/erp` FO home if FoCommand path, Agent cockpit if available. Confirm wells glow; rack grid cells remain flat opaque.

- [ ] **Step 7: Commit only if user asked**

---

### Task 4: Elevate existing glass chrome aliases + typecheck

**Files:**
- Modify: `web/src/components/erp/stay-hub/StayHubCashierDock.tsx` (add `neo-card` alongside `glass-happy-card`)
- Modify: `web/src/components/erp/RoomDayBoard.tsx` (any `glass-card` KPI shell → also `neo-card`)
- Verify: `pnpm --dir web run typecheck` (or IDE diagnostics on touched files)

**Interfaces:**
- Consumes: `.neo-card` from Task 1
- Produces: elevated docks/KPIs using both glass + neo for soft migration

- [ ] **Step 1: Add `neo-card` class next to glass on cashier dock and Day KPI `glass-card` shells**

Example dock:

```tsx
        "erp-cold-glass glass-happy-card neo-card sticky bottom-0 z-20 space-y-2 border-t px-3 py-2.5",
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --dir web run typecheck`

Expected: exit 0 (or zero new errors on touched files).

- [ ] **Step 3: Commit only if user asked**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `.neo-card` / `.neo-btn` / `.neo-well` + coral/mint/violet | Task 1 |
| Soft remap Card/Button under `.erp` | Task 1 + Task 2 |
| Occupancy / folio / progress gauges | Task 3 |
| StayHub dock / Day KPI chrome | Task 4 |
| Out of scope: rack cells, POS grids, tables | Task 3 step 5 constraint + Global Constraints |
| reduced-transparency / reduced-motion | Task 1 Step 2 |
| Desk only | Global Constraints |

No TBD/placeholder steps remain.
