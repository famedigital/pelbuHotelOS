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
