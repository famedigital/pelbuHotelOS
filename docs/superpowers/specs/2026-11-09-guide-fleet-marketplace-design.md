# Guide & Fleet Marketplace — Design Spec

**Date:** 2026-11-09  
**Status:** Approved (conversation) — awaiting user review of this file before implementation plan  
**Product:** Hotel OS / Innora v2  
**Related:** `docs/v2/MODULES.md` §15 Registry · Partner portal · opaque affiliate commissions

---

## 1. Problem

Hotels and tour agents need to **find** licensed guides and cars (and vice versa). Guides/drivers also need to **sell hotel rooms** and earn commission. Guests must never see guide or Innora fees on the bill.

What exists today that is **not** this product:

- FO **companions** (`/guide`, `/driver`) — ops tools for an already-assigned group (roster, breakfast, fuel). Wrong primary product for discovery.
- **Registry** (`/registry`) — master data only (licence, plate). No live availability, matching, or affiliate money.

---

## 2. Goals (v1)

1. **Innora-wide** discovery of guides and vehicles across properties in Bhutan.
2. Live **availability** for guides/drivers: free / busy / currently at hotel X (no guest PII).
3. **Request board**: hotel desk and tour agents post “need guide / need car”; guides/drivers accept.
4. **Guide/driver room sales**: guest pays **hotel tariff only**; commission pool split guide ↔ Innora after settle.
5. Privacy: before accept, no guest names/passports; after accept, minimum job detail only.

### Non-goals (v1)

- Public consumer OTA / guest-facing marketplace UI beyond a short book link.
- GPS tracking, QR payout wallets, biometric guide ID.
- Replacing agent MoU B2B rates (agents remain credit/MoU path).
- Making FO companions the “Guides & Fleet” product (companions may remain as optional post-assignment ops).

---

## 3. Locked decisions

| Topic | Decision |
|--------|----------|
| Network scope | **Innora-wide** (cross-hotel), not single-property silo |
| Demand posters | **Hotel desk and tour agents** both can post needs |
| Guest folio | **Tariff only** — no guide commission, no Innora commission line |
| Folio commercial party | Guest (FIT / walk-in style) pays hotel |
| Commission economics | Hybrid: **Innora platform default** + **hotel property override** (min–max) + optional **guide MoU** later |
| Default numbers (ship first) | **10% of room net** · split **70% guide / 30% Innora** |
| Privacy before accept | Hotel name, dates, pax count, languages, area/dzongkhag only |
| Privacy after accept | Hotel may share group/room code as needed for the job — still not full passport dump in marketplace UI |

---

## 4. Actors & surfaces

| Actor | Primary surface | Can do |
|--------|-----------------|--------|
| Guide | Field portal `/marketplace/guide` (PIN) | Set availability; browse/accept jobs; generate room sell link; view commission owed |
| Driver / fleet | Field portal `/marketplace/driver` | Same for vehicle; capacity/plate; jobs; room sell if enrolled |
| Hotel desk | `/registry` enhanced + Find / Requests | Post need; search available; attach to group; set property commission % |
| Tour agent | `/partner` → Guides & fleet tab | Post need; search; propose attach (desk confirms if hotel policy requires) |
| Innora platform | Super-admin / settings | Default % + min/max; settlement view |

Rename nav away from “Guide Companion / Driver Companion” as the primary Guides & Fleet entry → **Marketplace** (or keep companions under Ops after assignment).

---

## 5. Domain model (logical)

### 5.1 Profiles (extends Registry)

- `guide_profile`: id, display_name, languages[], licence_no, phone, status (`active`/`suspended`), property_affinity[] (optional soft prefs)
- `vehicle_profile`: id, plate, seats, vehicle_class, driver_profile_id, status
- `driver_profile`: id, display_name, licence_no, phone, linked vehicles[]

### 5.2 Availability (live)

- `presence_status`: `free` | `busy` | `at_property`
- `at_property_id` / `at_property_name` when `at_property` (public to network)
- `updated_at`, heartbeat optional later
- **Never** stores guest names on presence rows

### 5.3 Job requests

- `fleet_request`: id, kind (`guide` | `vehicle`), posted_by (`hotel` | `agent`), poster_property_id, poster_agent_id?, window_from, window_to, pax, languages[], area, notes_public, status (`open` | `accepted` | `cancelled` | `fulfilled`)
- On accept: `assignee_guide_id` / `assignee_vehicle_id`, `accepted_at`
- Link to `group_id` / stay only **after** accept (desk attach)

### 5.4 Room affiliate (opaque commission)

- `affiliate_referral`: id, referrer_kind (`guide` | `driver`), referrer_id, property_id, stay_id / booking_id, rate_snapshot_net, commission_rate_pct, innora_split_pct, guide_split_pct, status (`pending` | `accrued` | `payable` | `paid` | `void`)
- Guest folio lines: **room tariff only** (existing FO paths)
- Accrual trigger: stay nights paid / checkout paid (idempotent) → create commission AP lines **not** on guest folio
  - Payable to guide (AP / city-ledger style “commission payable”)
  - Payable to Innora (platform receivable / clearing)

---

## 6. Money integrity

- All commission accrual in **atomic** Postgres function with `idempotency_key` (stay_id + night or stay_id + settlement event).
- No guest-visible description containing “commission”, “guide fee”, or “Innora”.
- Hotel Settings: `affiliate_commission_pct` clamped to platform `[min, max]`.
- Void/cancel stay → reverse accrual via append-only reversal (no in-place mutate).
- Guide payout is **not** cash from till by default in v1 — ledger “commission payable”; payout batch later.

---

## 7. UX outline

### Guide/driver marketplace home

- Big status control: Free / Busy / At hotel (picker of Innora properties)
- Open jobs list (cards): hotel, dates, pax, language — Accept / Decline
- “Sell a room” → property picker → shareable hold link (guest sees public/tariff quote)
- Earnings: pending / payable totals (no guest names)

### Hotel / agent find

- Filters: free now, language, seats, area, licence verified
- Request form → posts to Innora-wide board
- After accept → “Attach to group” (StayHub / Groups)

### Privacy copy

- Explicit empty states: “Guest details hidden until you accept.”

---

## 8. Relation to existing companions

| Feature | Marketplace (this spec) | FO companion (existing) |
|---------|-------------------------|-------------------------|
| Find free guide | Yes | No |
| Sell room + commission | Yes | No |
| Group roster / CI / breakfast | No | Yes (optional after attach) |
| Fuel advance | No | Yes (driver ops) |

Implementation may **repurpose** `/guide` and `/driver` routes to marketplace-first shells, with companions behind “My assignment” once a job is attached — or keep companions at `/ecosystem/*` and put marketplace at `/marketplace/*`. Prefer **marketplace as primary** nav under Guides & Fleet.

---

## 9. Phased delivery

| Phase | Deliverable |
|-------|-------------|
| **P0** | Presence + profiles seed; Innora-wide find UI (hotel + agent + guide/driver); request board accept/decline; privacy masks |
| **P1** | Affiliate room sell link; opaque commission accrual RPC; hotel % settings; earnings view |
| **P2** | Guide MoU special rates; payout batches; notifications (Telegram/Hermes optional) |

---

## 10. Open items (non-blocking)

- Exact public book URL shape (desk deep link vs marketplace short link).
- Whether agents may attach guides without hotel desk confirm (default: **hotel confirm** when stay is at that property).
- DOT licence verification workflow beyond “verified” flag.

---

## 11. Spec self-review

- [x] No `TODO` placeholders in requirements  
- [x] Money path specified as opaque + atomic + idempotent  
- [x] Explicit non-goals (companions ≠ marketplace)  
- [x] Privacy before/after accept defined  
- [x] Defaults numeric and overridable  
- [x] Scope phased so P0 is shippable without full payout rails  

---

## 12. Approval

Conversation approval: **2026-11-09** (Approach B + Innora-wide + opaque tariff commissions).

**Next:** User reviews this file → then implementation plan via writing-plans → execute P0.
