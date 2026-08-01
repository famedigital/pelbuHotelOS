# Launch checklist — Pelbu Olakha (single-hotel)

Use before cutting over to production. Owner signs each box.

## Environment (Vercel production)

- [ ] `CRON_SECRET` set (night-audit + expire-holds fail closed / authenticated)
- [ ] `DESK_PIN` set (fallback until RBAC Wave 1d retires it in production)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Cloudinary + Resend configured
- [ ] Set `ALLOW_DESK_PIN_IN_PROD=1` for launch day if staff Auth not fully rolled out; remove after desk_role RBAC is live
- [ ] Optional: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` after Wave 1a
- [ ] Optional: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for distributed rate limits (in-memory fallback works on single instance)
- [ ] Optional until Channel cert: `CHANNEX_API_KEY`, `CHANNEX_WEBHOOK_SECRET` (Preview first — see [CHANNEX-CERT.md](CHANNEX-CERT.md))

## Auth

- [ ] At least one `staff_members` row with `can_access_desk = true` and Auth login
- [ ] Supabase Dashboard → Authentication → Providers → enable **Leaked password protection** (HaveIBeenPwned)
- [ ] Confirm `/erp/login` works with PIN and/or staff Auth

## Smoke UAT (from docs/UAT-CHECKLIST.md)

- [ ] Public `/book` creates held booking
- [ ] Desk check-in assigns rooms + opens folio
- [ ] Folio payment posts + balance updates
- [ ] POS room charge → folio line + journal
- [ ] Manual night audit once for today's business date (or wait for cron `0 18 * * *` UTC)

## Data safety

- [ ] Supabase PITR / daily backups enabled on project
- [ ] Know who gets CallMeBot if night-audit cron fails

## Sign-off

| Role | Name | Date |
|------|------|------|
| Owner | | |
| Desk lead | | |

See also: [WHITEBOARD.md](WHITEBOARD.md), [UAT-CHECKLIST.md](UAT-CHECKLIST.md), [ERP-AUDIT.md](ERP-AUDIT.md).
