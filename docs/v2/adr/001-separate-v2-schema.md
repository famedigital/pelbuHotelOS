# ADR 001 — Separate `v2` schema on existing Supabase

**Status:** Accepted (owner 2026-11-07)  
**Date:** 2026-11-08

## Context

A second self-hosted Supabase stack (~10 containers) would compete with live Innora FO RAM on the droplet. v2 must be a separate product without a second database server.

## Decision

1. Reuse the **existing** self-hosted Supabase / Postgres.
2. All v2 tables live in Postgres schema **`v2`**. Migrations under `v2/packages/db/migrations` — **never** `supabase/migrations` (Innora).
3. API role **`v2_app`**: grants on schema `v2` only; **no grants on `public`** (v1).
4. API refuses to start if its DB role can `SELECT` from `public.bookings`.
5. Auth: Supabase Auth + staff PIN → short-lived JWT (`app='v2'`, `tenant_id`, `role`, `staff_id`).
6. Realtime on `v2.*`; agents only on masked `v2.partner_calendar`.
7. Storage buckets `v2-docs` (private) and `v2-media` (public).
8. Events outbox `v2.events` + `LISTEN v2_events` worker (one connection).

## Consequences

- Innora `web/` and root `apps/*` stay live/reference until cutover.
- New code only under top-level `v2/`.
- Cutover uses re-runnable ETL `public.*` → `v2.*` (see SOURCE-MAP MIGRATE).
- Droplet: confirm `docker stats` headroom before Phase 0 deploy (~1 GB for api+desk+web).
