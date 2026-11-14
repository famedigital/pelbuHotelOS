# ADR 002 — Travel Agent OS tenancy, trip graph, and portal sessions

**Status:** Proposed (owner review 2026-11-13)  
**Date:** 2026-11-13  
**Depends on:** [ADR 001](./001-separate-v2-schema.md)  
**Docs home:** [`../travel-agent-os/README.md`](../travel-agent-os/README.md)

## Context

Hotel OS v2 already has property-scoped `portal_accounts`, hotel-side `agents` / guides / drivers, and a Partner UI that is largely client/demo. Tour operators need an **agency OS** (trips, pools, budget, docs, shares) that plugs into Innora hotels without overloading `bookings` or hotel `guides` tables. Auth today uses HMAC desk tokens in `sessionStorage` (no httpOnly cookies, no `exp`).

## Decisions

1. **Agency tenant:** New first-class `v2.agency_orgs` (+ `agency_members`). Travel Agent OS data is scoped by `agency_org_id`, not `property_id`.
2. **Bridge to Hotel OS:** Each org links to one or more hotel B2B agent rows via `agency_org_hotel_links (agency_org_id, property_id, agent_id)` aligning with existing MoU / `agent_property_links` semantics. Room holds still create hotel `bookings` under that `agent_id`.
3. **Trip graph:** New tables `trips`, `trip_days`, `trip_stays`, `trip_staff`, `trip_budget_lines`, `trip_documents`, `share_links` — **not** a reuse of `bookings` as itinerary container.
4. **Pools:** `agency_guides`, `agency_drivers`, `agency_vehicles` are agency-owned. Hotel `guides`/`drivers` remain property visit masters. Optional FK to `national_guides` later.
5. **Money units:** All agency money fields are **integer chhetrum** (same as Hotel OS). Margin math is pure domain (M02).
6. **Share privacy:** Server-side projection (`projectShareTier`) + `share_links` with hashed tokens. No Vite-bundled HMAC secrets for trip shares. Tiers: `guest` | `guide` | `driver` | `hotel` | `agency`.
7. **Sessions (phased):**
   - **Phase A (M01):** Desk/portal HMAC tokens gain mandatory `exp`, refuse default `DESK_JWT_SECRET`, portal roles enter permission matrix, bind `subjectId`/`agencyOrgId` from claims (never trust client ids), gate sensitive GETs, disable demo field PINs unless `ALLOW_E2E_DEMO_AUTH`.
   - **Phase B (later module or M01.1):** httpOnly `__Host-` cookies + CSRF; migrate off `sessionStorage` Bearer.
8. **Migrations:** Agency tables live in schema **`v2`** under `v2/packages/db/migrations` (ADR 001). Do not put Travel Agent OS tables only in root `supabase/migrations`.
9. **Build order:** Hierarchical RDITP per module (`docs/v2/travel-agent-os/`). No organism/Hotel OS integration coding until lower modules reach Production.
10. **Ship path:** Coolify droplet + local CI ladder. GitHub Actions optional mirror later — not a blocker.

## Consequences

- Soultrips (and every TO) gets an `agency_org`; email login resolves org membership + portal role → `/partner` | `/guide` | `/driver`.
- Partner chrome rename to Travel Agent OS happens in a later module after M01 auth/org works.
- [`AGENT-PORTAL.md`](../AGENT-PORTAL.md) is stale until rewritten as an index into `travel-agent-os/`.
- Implementers must not invent Redis/GH Actions/cookie Phase B in M01 unless Design says so — Phase A only for first implement.

## Non-decisions (explicitly deferred)

- Full Gemini itinerary AI  
- Agency payroll HR  
- Replacing hotel FO ledger  
- National GMS scrape  
