# public → v2 ETL (cutover)

**Auth model (owner locked):**

| Item | Value |
|------|--------|
| Organization | Pelbu Suites (one org) |
| Properties | `pelbu-olakha` (Pelbu Suites Olakha) + `pelbu-suites-olakha` (DEMO) |
| Owner login | `pelbusuites@gmail.com` (password via env only — never commit) |
| Staff access | Pin Gateway → pick hotel → pick self → PIN → role dashboard (`home_route`) |

Rooms / types are copied **1:1** from `public.room_units` + `public.room_types` for both hotels.

**Pelbu Suites Olakha guest inventory** (canonical: [`docs/rate-agent.html`](../../docs/rate-agent.html)): **27 sellable rooms** = Deluxe King/Twin **26** + Suite **1**. Guide/driver beds are extra complimentary units in `room_units`, not part of the 27.

Staff PINs are **not** copied from Innora Auth (SOURCE-MAP 7.6). First unlock after cutover sets a new PIN (confirm step).

```bash
# Inventory (org + properties + rooms + staff)
# On droplet: bash scripts/cutover/droplet-run-etl.sh  (01_*.sql)

# Ops (agents + active bookings + assignments + folios + sequences)
# On droplet: bash scripts/cutover/droplet-run-ops-etl.sh /tmp/02_etl.sql
```

```bash
# Dry-run inventory counts (local)
cd v2
DATABASE_URL=postgres://... node scripts/etl/run-etl.mjs --dry-run
DATABASE_URL=postgres://... node scripts/etl/run-etl.mjs --apply
```


On droplet (after migrations through `0011_staff_desk_login.sql`):

```bash
docker cp v2/scripts/etl supabase-db:/tmp/hos-v2-etl
docker exec -e DATABASE_URL=postgres://postgres:...@127.0.0.1:5432/postgres \
  supabase-db bash -c 'cd /tmp && ...'
# Or pipe SQL:
docker exec -i supabase-db psql -U postgres -d postgres \
  -c "SELECT set_config('hos.etl_mode','apply',false)" \
  -f /tmp/hos-v2-etl/01_org_properties_rooms_staff.sql
```
