# Hotel OS — Supabase (`hotelos` database)

Apply **all** files in `migrations/` in order to the **hotelos** Postgres database.

## Channel migration

`20260915010000_platform_channel.sql` adds:

- `distributors` / `distributor_members`
- `platform_admins`
- `catalog_packages` (Classic/Plus/Pro/Portfolio/Chain seed prices)
- tenant/property AMC, conditions, go-live checklist, demo flag
- `amc_invoices`, `royalty_invoices`, `sales_leads`, `support_tickets`, `platform_audit_events`

Do **not** restore `backups/pelbu-full.*` into hotelos.

## Two databases on one host

| DB | Load |
|----|------|
| `pelbu` | Pelbu dump |
| `hotelos` | These migrations only |

```bash
export DATABASE_URL="postgresql://postgres:...@127.0.0.1:5432/hotelos"
for f in migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```
