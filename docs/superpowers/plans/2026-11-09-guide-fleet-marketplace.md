# Guide & Fleet Marketplace Implementation Plan

> **For agentic workers:** Implement task-by-task. Spec: `docs/superpowers/specs/2026-11-09-guide-fleet-marketplace-design.md`

**Goal:** Ship Innora-wide guide/vehicle presence + request matching, then opaque guide room-sale commissions (guest sees tariff only).

**Architecture:** Desk Zustand marketplace store (seed + local) wired to Registry / Partner / field portals; P1 commission accrual as pure ledger helpers + UI (Postgres RPC later). FO companions demoted under “My assignment”.

**Tech Stack:** v2 desk React, Zustand, existing FieldPortalGate, commercial rates for tariff quotes.

## Global Constraints

- Guest folio never shows guide/Innora commission
- Presence/request cards: no guest PII before accept
- Innora-wide (multi-property names in seed)
- Default commission 10% · 70/30 guide/Innora; hotel override clamped
- No stubs / silent catch / invented DB columns

---

### Task 1: Marketplace store

**Files:**
- Create: `v2/apps/desk/src/lib/marketplace-store.ts`

- [ ] Profiles from Registry guides/vehicles + presence + requests + referrals
- [ ] Actions: setPresence, postRequest, accept/decline, createReferral, accrueCommission

### Task 2: Field marketplace UI

**Files:**
- Modify: `GuideCompanionPage.tsx`, `DriverCompanionPage.tsx` → marketplace-first + “My assignment” companion section

### Task 3: Hotel Registry Find

**Files:**
- Modify: `RegistryPage.tsx` — Find & requests tab

### Task 4: Partner tab

**Files:**
- Modify: `PartnerPortalPage.tsx` — Guides & fleet tab

### Task 5: Settings + earnings

**Files:**
- marketplace settings on Registry or Settings strip; earnings on field portals

### Task 6: Verify

- `pnpm --dir v2/apps/desk run typecheck` + browser smoke
