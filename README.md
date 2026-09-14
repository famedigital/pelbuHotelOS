# Hotel OS (pelbuHotelOS)

Bhutan-first **multi-tenant hotel ERP** with marketing site, Fame Digital platform admin, distributor partner portal, and hotel desk.

## Surfaces

| Path | Who |
|------|-----|
| `/` `/pricing` `/conditions` `/demo` `/for/*` | Bhutan hoteliers (marketing) |
| `/admin` | Fame Digital (royalty, distributors, all hotels) |
| `/partner` | Distributors (onboard & AMC for their hotels) |
| `/erp` `/staff` `/agents` | Hotel operations |

## Channel model

Fame Digital → distributors (2–3 offices) → hotels. Or Fame direct (`distributor_id` null).  
Leased multi-hotel owners = one **tenant**, many **properties**.

## Pricing (catalog seed)

- Classic **3,500** BTN/mo · Plus **5,500** · Pro **8,500** · Portfolio **3,000**/property + portfolio fee  
- Onboarding **25,000** · Training **15,000** (see `/pricing` and `web/src/lib/pricing-catalog.ts`)  
- Conditions: `/conditions` — fair-use support, authorised contacts, no abuse  

## Databases (VPS)

One Postgres host, **two databases**:

1. **`pelbu`** — live Pelbu Suites (`backups/` gitignored)  
2. **`hotelos`** — this product — apply `supabase/migrations` including `20260915010000_platform_channel.sql`

## Dev

```bash
cd web
cp .env.example .env.local
# Set PLATFORM_ADMIN_EMAILS=you@famedigital.bt
npm install
npm run dev
```

- Marketing: http://localhost:3000/  
- Admin: `/admin/login`  
- Partner: `/partner/login`  
- Desk: `/erp/login`

Create Supabase Auth users, then:

- Platform: email in `PLATFORM_ADMIN_EMAILS` or row in `platform_admins`  
- Partner: row in `distributor_members` linked to a `distributors` row  

## GitHub

https://github.com/famedigital/pelbuHotelOS.git (push when ready)
