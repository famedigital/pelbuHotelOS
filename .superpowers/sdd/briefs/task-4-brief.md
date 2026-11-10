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

Expected: exit 0 (or zero new errors on touched files). If `pnpm` missing, use `npx tsc --noEmit -p web` or `npm --prefix web run typecheck`.

- [ ] **Step 3: Commit only if user asked**

Do not commit unless the user explicitly requests a commit.
