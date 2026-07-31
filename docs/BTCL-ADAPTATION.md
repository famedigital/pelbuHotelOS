# BTCL adaptation — multi-hotel chain on Pelbu OS

**Client context:** Bhutan Tourism Corporation Limited (BTCL) — multiple hotels, restaurants, **200+ staff**, bookings via advanced public websites, ops that must be easier than Excel / fragmented tools.

**Date:** 2026-07-31.  
**Depends on:** [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md), [ERP-AUDIT.md](ERP-AUDIT.md).

This is an **adaptation plan**, not a rebuild. Pelbu OS already has `property_id`, group overview, HR/payroll, multi-outlet POS, and CMS. BTCL needs **tenant = chain**, **property = hotel**, **outlet = restaurant/bar**, and process hardening so a chain auditor trusts the books.

---

## 1. Map BTCL language → Pelbu model

| BTCL language | Pelbu OS entity | Notes |
|---------------|-----------------|-------|
| Corporation / chain | `tenants` (new) | One BTCL tenant |
| Hotel / lodge | `properties` | Each site has rooms, rates, CMS, desk |
| Restaurant / bar / café | `property_outlets` + POS outlet | Multiple per hotel |
| Central reservations | Agent / channel + group booking tools | Call centre books across properties |
| HQ finance | Tenant-level reports + per-property night audit | Consolidate GST / income |
| 200+ staff | `staff_members` + HR modules | Rota, attendance, leave, payroll already sketched |
| Public websites | Per-property CMS on custom domains | Host routing required |
| Brand site | Optional marketing property or static | Can sit outside PMS |

Pelbu Suites Olakha stays `template_id = 1`. BTCL hotels **clone** the template, then replace content, rates, room maps, and logos.

---

## 2. What BTCL gets that a single boutique hotel does not

| Capability | Boutique (Pelbu today) | BTCL need |
|------------|------------------------|-----------|
| Property switcher | Desk cookie | Yes + **HQ role** that can see all hotels |
| Shared guest / agent master | Per property | Optional **tenant-level** guest/agent with property folios |
| Central rate / allotment | Per property | Chain rate plans + allotments per hotel |
| Cross-property availability | Group overview | CRS-style search across hotels for call centre |
| Multi-outlet F&B | POS outlets | Several restaurants per hotel + HQ menu governance |
| HR at scale | HR screens | Biometric devices, rota conflicts, payroll batches of 200+ |
| Audit | Soft | Period lock, night audit cron, immutable folios (ERP-AUDIT Phase A) |
| Public sites | One brand | One domain **per hotel** + optional BTCL brand portal |
| Messaging | CallMeBot | WhatsApp Business / approved BSP; no shared personal bots |

---

## 3. Phased delivery for BTCL

### Phase 0 — Preconditions (Pelbu product, before contract go-live)

Must complete ERP-AUDIT **Phase A**:

1. Room-night posting + night-audit cron  
2. Folio immutability + reversals  
3. Period lock on posts  
4. Laundry catalog + reverse on void  
5. RLS policies on zero-policy tables  

Without these, a chain finance team will reject the system regardless of UI polish.

### Phase 1 — Tenancy + Host (white-label MVP)

1. Create `tenants` row for BTCL; attach all BTCL `properties`.  
2. `property_hostnames` for each hotel public + desk host.  
3. Staff Auth only on desk hosts; map staff → one or many properties.  
4. Clone template_1 → each hotel CMS + room types (empty rates until yield team fills).  
5. HQ login lands on `/erp/group` (chain dashboard), not a single hotel rack.

### Phase 2 — Chain ops

1. **CRS lite:** search availability across BTCL properties; create booking on chosen hotel.  
2. **Tenant-level agents** with per-property credit limits.  
3. **Allotments** per hotel for tour series.  
4. **Consolidated night-audit report** (all hotels closed Y/N).  
5. **POS:** outlet templates; KDS per kitchen; HQ menu catalogue with property price overrides.

### Phase 3 — People & scale (200+ staff)

1. Employment events, leave policies, blackouts per property.  
2. Attendance devices (`attendance_devices`) + biometric API hardening.  
3. Payroll runs batched; payslip PDF; bank export.  
4. Role matrix: HK, F&B cashier, front office, revenue, finance, HR, GM, HQ auditor.  
5. Soft delete + transfer staff between properties without losing history.

### Phase 4 — Public websites “international standard”

Per hotel:

1. Custom domain + SSL (CNAME to platform).  
2. Conversion homepage (template clone) — rooms, F&B, spa/meeting as applicable.  
3. Booking engine with holds, deposits, agent vouchers.  
4. SEO: sitemap, canonicals, structured data (already in Pelbu public).  
5. Performance budget (Core Web Vitals) and accessibility pass before launch.

Optional BTCL brand portal: lists hotels and deep-links into each property book flow with `property_id` preserved.

---

## 4. Data & infra sizing (order of magnitude)

| Area | Guidance |
|------|----------|
| Hotels | Start 3–5 pilot properties; schema supports more |
| Rooms / property | Room units + assignments already model physical inventory |
| Outlets / property | 2–6 typical |
| Staff | 200+ → index attendance/payroll by period; avoid N+1 on payslip screens |
| Concurrent desk | Prefer Realtime channels per property, not global |
| Backups | Daily logical + PITR (Supabase) or RDS snapshots if AWS later |
| WhatsApp | Official Cloud API; estimate messages/month for cost |

---

## 5. Roles & access (BTCL)

| Role | Scope | Can |
|------|-------|-----|
| Front office | One property | Check-in/out, folio, calendar |
| F&B cashier | One property + outlets | POS, voids with reason |
| HK / laundry | One property | Rooms, laundry CoC |
| Hotel GM | One property | Reports, overrides with audit |
| Revenue | Tenant or property | Rates, allotments, channel |
| HQ finance | Tenant | Period close review, GST consolidate |
| HR | Tenant / property | Rota, leave, payroll |
| Platform admin (you) | All tenants | Only for SaaS support — break-glass |

Replace shared DESK_PIN for BTCL with named staff accounts.

---

## 6. Integration list for BTCL workshops

Bring these to the first workshop so scope is explicit:

1. Existing PMS / Excel cutover mapping (rooms, open folios, agents).  
2. Bank accounts per hotel vs central.  
3. GST registration(s) — one TPN or many.  
4. Channel manager (Channex already sketched) — which OTAs.  
5. Biometric vendor for attendance.  
6. Payment: Pay.bt / QR / card — per hotel merchant IDs.  
7. Domain list (public + desk) and who controls DNS.  
8. WhatsApp sender numbers and message templates.

---

## 7. Success criteria (acceptance)

BTCL go-live for a pilot hotel is **not** “pages exist.” It is:

1. Night audit posts room nights; folio balance matches rack.  
2. Check-out blocked (or override-audited) when balance ≠ 0.  
3. POS settle posts folio or cash tender with journal.  
4. Staff can only see their property unless HQ role.  
5. Public site on customer domain books into that property only.  
6. Payroll run for that hotel’s staff closes without manual Excel.  
7. UAT-CHECKLIST.md signed by hotel GM + HQ finance.

---

## 8. Commercial packaging (suggestion)

| Package | Includes |
|---------|----------|
| BTCL Hotel | One property: desk + public site + POS + laundry + HK |
| BTCL F&B add-on | Extra outlets + KDS |
| BTCL Workforce | HR / attendance / payroll |
| BTCL Chain | Tenant CRS, consolidated audit, HQ roles |
| BTCL Channel | Channex / OTA ARI |

Implementation fees cover data migration and domain cutover; SaaS fee covers hosting and support.

---

## 9. Honest risks

| Risk | Mitigation |
|------|------------|
| Shipping UI before night audit / period lock | Contract Phase 0 into the SOW |
| Shared admin client leaks cross-property data | Staff-scoped clients + RLS (ERP-AUDIT SEC-01/02) |
| One WhatsApp bot for the chain | Per-property Cloud API numbers |
| “Make the website world class” without content | BTCL supplies photography + rates; you supply template + CMS |
| 200 staff on unindexed queries | Load-test payroll + attendance before Phase 3 sign-off |

---

## 10. Recommended next conversation with BTCL

1. Confirm hotel list + pilot (1 hotel + 1 restaurant).  
2. Confirm DNS ownership and merchant IDs.  
3. Walk ERP-AUDIT Phase A as non-negotiable.  
4. Demo current Pelbu desk on a cloned empty property.  
5. Sign Phase 1 (tenancy + Host) only after Phase 0 date is locked.
