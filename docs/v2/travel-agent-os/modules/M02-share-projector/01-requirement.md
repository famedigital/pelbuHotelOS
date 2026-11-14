# M02 — Share-tier projector + trip margin math

**Status:** APPROVED 2026-11-13 (PM cycle — proceed Implement)  
**Layer:** L0 (pure domain — no DB required for first ship)  
**Depends on:** ADR 002 (decisions only)  
**Blocks:** M08 (budget UI), M10 (share links), M11 (companions must use projector)

---

## 1. Purpose

Define **deterministic, tested** pure functions that:

1. Compute trip **cost / sell / margin** in integer chhetrum.  
2. **Project** a full agency trip DTO into tier-safe views (guest, guide, driver, hotel, agency) so rates and margin never leak by UI mistake.

This is the atom. No Fastify routes required in M02 Implement beyond exporting from `@hos-v2/domain` and unit tests. M10 will call these when issuing shares.

## 2. Actors (consumers)

| Consumer | Uses |
|----------|------|
| Agency finance UI (M08) | `tripMargin()` |
| Share issue API (M10) | `projectShareTier()` |
| Guide/Driver/Guest/Hotel share pages | Pre-projected DTO only — never raw trip |
| Hotel voucher | `hotel` tier with `hideRates: true` default |

## 3. User stories

1. **Given** costs 75000 chh and sell 150000 chh, **when** `tripMargin` runs, **then** marginChh=75000 and marginBps=5000 (50.00% of sell).  
2. **Given** sell 0, **when** margin runs, **then** marginBps=0 (no divide-by-zero).  
3. **Given** a full trip record with net rates and margin, **when** projected to `guide`, **then** output has no `nightlyNetRate`, `clientGrossSell`, `sdfTotal` detail, `netProfitMargin`, or budget lines.  
4. **Given** same record and `hotel` tier with `hideRates: true`, **then** rooming/meal/guide name present; nets/sell/margin absent.  
5. **Given** `agency` tier, **then** full financials present.  
6. **Given** unknown tier string, **then** function throws typed error (fail closed — never return agency view).

## 4. In scope

- Domain module under `v2/packages/domain/src/agency/` (or `travel-agent/`)
- Types for `AgencyTripRecord` (minimal fields needed for projection — may use a narrow interface until M05 exists)
- `sumBudgetCosts`, `tripMargin`, `projectShareTier`
- Exhaustive unit tests
- Re-export from domain package index

## 5. Out of scope

- Persistence of budget lines / share_links (M08/M10)
- PDF generation (M09)
- UI
- Cookie/auth
- Reading live bookings

## 6. Entities (logical — not tables in M02)

- Budget line kinds: `sdf` | `hotel` | `guide` | `vehicle` | `entry` | `misc` | `sell`
- Share tiers: `agency` | `guest` | `guide` | `driver` | `hotel`

## 7. Commands

None (pure library). Future M10 wraps projection after load.

## 8. Privacy / never-leak (hard)

For tiers other than `agency`:

| Field | guest | guide | driver | hotel (hideRates) |
|-------|-------|-------|--------|-------------------|
| Day narrative / title | Y | Y | pickup summary only | N (stay-focused) |
| Hotel name | Y | Y | Y | own property only |
| Room numbers | N | Y if assigned | Y if assigned | Y |
| Dietary | limited | Y | N | Y if meal relevant |
| Passport / ID URLs | N | N | N | N |
| nightlyNetRate | N | N | N | N |
| clientGrossSell | N | N | N | N |
| margin / budget lines | N | N | N | N |
| SDF government total | N | N | N | N |
| Guide phone | N | self | Y | Y |
| Driver phone | N | Y | self | optional |

Exact field list frozen in Design §3 matrix (must match tests).

## 9. Edge cases

| Case | Expected |
|------|----------|
| Negative cost line | Allowed only if kind is adjustment; Design specifies — default reject negative except `sell` credit notes later |
| Empty cost lines, sell set | margin = sell (costs 0) |
| hotel tier `hideRates: false` | Still redacts client sell + margin; may show MoU net **only** if Design flag `showHotelNet` — **default false** for Bhutan agency privacy |
| Extra unexpected keys on input | Projection returns only allowlisted keys (strip unknown) |

## 10. Acceptance criteria

- [ ] 100% of matrix cells covered by unit tests  
- [ ] No I/O imports in the module  
- [ ] `pnpm --dir v2 test` (or domain filter) includes new tests green  
- [ ] Fail-closed on bad tier  
- [ ] Documented export path for M08/M10  

## 11. Dependencies

- None on M01. Can implement in parallel with M01.
