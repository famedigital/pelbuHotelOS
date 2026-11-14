# M01 — Implement notes

**Status:** IN_PROGRESS 2026-11-13 (security + schema + commands landed; seed member + settings UI + e2e pending)

## Done this cycle

- `v2/packages/db/migrations/0015_agency_orgs.sql` — agency_orgs, members, hotel_links + Soultrips org seed shell
- Drizzle: `agencyOrgs`, `agencyMembers`, `agencyOrgHotelLinks` in `schema.ts`
- `desk-token.ts` — `exp` required, timing-safe verify, `agencyOrgId` claim, refuse default secret in production
- Portal permission matrix: `agent` / `guide` / `driver`
- `agency.org.get` | `members.list` | `hotelLinks.list` commands
- `/v1/partners/snapshot` requires Bearer + property match
- Demo field PIN gated behind `DEV` / `VITE_ALLOW_E2E_DEMO_AUTH`
- Unified + portal email login attach `agencyOrgId` when `agency_members` row exists
- Domain helpers: `agencyOrgIdFromActor`, `assertAgencyOrgMatchesClaim`

## Still open for M01 Production

1. Ops seed: `agency_members` row for Soultrips GoTrue user + `agency_org_hotel_links` to Pelbu agent  
2. Partner settings UI showing org name / members  
3. Playwright `agency-m01-login-org.spec.ts`  
4. Droplet migrate `0015` + Coolify restart  

## Deviations

- SQL uses `text` slug (not citext) to avoid extension dependency  
- `queryRaw` has no bind params — UUID validated then embedded (same pattern as partners snapshot)
