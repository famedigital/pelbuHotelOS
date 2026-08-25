# Desk read-cache + premium FO — OPS

## Kill-switches

| Env | Effect |
|---|---|
| `NEXT_PUBLIC_DESK_READ_CACHE=0` | Disable IndexedDB SWR; network-only desk reads |
| `NEXT_PUBLIC_DESK_REFRESH_AFTER_BOOK=1` | Restore `router.refresh()` after Fast Book Save (escape hatch) |

Set in Vercel project env (Preview/Production). Redeploy after change.

## Region

`web/vercel.json` pins `"regions": ["sin1"]` (Singapore). Verify after deploy that `VERCEL_REGION=sin1`. Supabase remains SG Asia.

## UAT checklist

- [ ] Save booking: toast + StayHub; no rack white-flash; typical &lt;3s on SG+sin1
- [ ] Button `citrus` / `gold` still work on desk
- [ ] DeskShell sidebar unchanged; public home unchanged
- [ ] FO: POS cart empty-state; reservations empty-state; Fast Book enter motion ≤200ms
- [ ] POS 2nd open shows Cached/Syncing chip; tickets patch without full RSC when Live fires
- [ ] Property switch: wipe prior property cache; no cross-hotel flash
- [ ] Airplane: cache read OK; Send/Settle fail clearly (money online-only)
- [ ] `DESK_READ_CACHE=0`: network-only
- [ ] Folio settle still respects fingerprint / stale banner
- [ ] `npm run build` green; unit tests `desk-read-cache.test.ts` pass

## Rollback

| Layer | Action |
|---|---|
| Cache | `NEXT_PUBLIC_DESK_READ_CACHE=0` |
| Save P0 | `NEXT_PUBLIC_DESK_REFRESH_AFTER_BOOK=1` only if StayHub/confirm pack breaks |
| Premium A-tier | Unused UI imports safe; revert B-tier from git if needed |
| Region | Remove `regions` from vercel.json only if sin1 broken |

## Notes

- Money (settle / send / folio post) is never authorized from cache.
- Live refresh prefers ticket/list patch; falls back to `router.refresh()` on error.
- Premium kit: Pelbu-native A-tier; B/C/D not overwritten — see `docs/ops/premium-ui-kit-conflict-report.md`.
