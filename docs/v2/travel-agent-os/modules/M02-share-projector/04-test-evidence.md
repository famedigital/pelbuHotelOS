# M02 — Test evidence

**Status:** DONE 2026-11-13

```text
pnpm --dir v2/packages/domain exec node --import tsx --test src/agency/*.test.ts

tests 14
pass 14
fail 0
```

Full domain suite previously 62/64 before fixture fix; agency suite alone 14/14 after correction.
