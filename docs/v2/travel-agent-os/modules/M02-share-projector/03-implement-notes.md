# M02 — Implement notes

**Status:** DONE 2026-11-13

## Files

- `v2/packages/domain/src/agency/types.ts`
- `v2/packages/domain/src/agency/money.ts`
- `v2/packages/domain/src/agency/project-share-tier.ts`
- `v2/packages/domain/src/agency/money.test.ts`
- `v2/packages/domain/src/agency/project-share-tier.test.ts`
- `v2/packages/domain/src/agency/index.ts`
- Re-export via `v2/packages/domain/src/index.ts`
- `package.json` test glob includes `src/agency/*.test.ts`

## Deviation from Design

Requirement originally said cost 100k / sell 150k → 50% margin. That is **markup on cost**, not margin on sell. Spec corrected: marginBps = margin/sell; 50% example is cost 75k / sell 150k. Tests updated accordingly.
