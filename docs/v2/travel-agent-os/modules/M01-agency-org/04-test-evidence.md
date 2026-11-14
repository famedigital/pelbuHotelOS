# M01 — Test evidence

**Status:** PARTIAL 2026-11-13

## Unit

```text
pnpm --dir v2/packages/domain test
→ 67 pass / 0 fail (includes agency claims + agent permissions)

pnpm --dir v2/apps/api exec node --import tsx --test src/platform/desk-token.test.ts
→ 4 pass / 0 fail (exp, expired, missing exp, prod secret assert)
```

## Typecheck

```text
pnpm --dir v2/packages/domain typecheck  → ok
pnpm --dir v2/apps/api typecheck         → ok
```

## Not yet

- Integration against live Postgres (org get cross-tenant)
- E2E soultrip login → org name
- Droplet migrate smoke
