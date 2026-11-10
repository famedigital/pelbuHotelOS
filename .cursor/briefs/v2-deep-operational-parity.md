# Cursor Master Brief: Hotel OS v2 Deep Operational Parity

**Mission:** Elevate `v2` from its current high-level "baby version" skeleton into the full operational depth of the 80-day Innora v1 codebase across all 15 hotel departments, enforcing the non-negotiable Bhutanese operational laws with zero superficial stubs.

---

## 1. Scope & Core Stack
- **Monorepo Root:** `v2/`
- **Database Schema:** `v2/packages/db/src/schema.ts` (Drizzle ORM, schema `v2`)
- **Backend Fastify API:** `v2/apps/api/src/` (Fastify 5, Node 22, TypeScript)
- **Desk ERP SPA:** `v2/apps/desk/src/` (Vite 6, React 19, Tailwind, Motion)
- **Shared UI & Hardware:** `v2/packages/ui/`, `v2/packages/hardware/`

---

## 2. The 6 Non-Negotiable Operational Realities ("The Harded Stuff")

### 1. The Cash Drawer Sync Law (Centenary Farmers Market Procurement)
- **Flow:**
  1. Cashier issues `Cash Advance` (e.g. Nu. 15,000) from Front Desk Till.
  2. Till balance immediately drops by Nu. 15,000 with a physical drawer movement audit record.
  3. Purchaser returns with receipts totaling Nu. 13,850 and returns Nu. 1,150 change.
  4. System records line-item inventory stock-in, credits the till Nu. 1,150, and archives paper vendor slips.
- **Enforcement:** No procurement invoice can be marked "Paid in Cash" without linking to a Front Desk Till advance transaction.

### 2. Biometric ZKTeco iClock Push Protocol (`/iclock/cdata`)
- **Flow:** Physical wall-mounted biometric fingerprint/facial scanner communicates via ADMS firmware push:
  - `GET /iclock/cdata?SN=...&options=all` $\rightarrow$ Server responds with handshake `GET OPTION FROM: ...\nStamp=...\nOpStamp=...\nErrorDelay=30\nDelay=10\nTransTimes=00:00;14:05\nTransInterval=1\nTransFlag=1111000000\nTimeZone=6\nRealtime=1\nEncrypt=0`.
  - `POST /iclock/cdata?table=ATTLOG&SN=...` sending raw text lines: `101\t2026-11-08 07:45:12\t0\t1`.
  - Server parses employee punch, validates shift window, computes late penalty, and returns HTTP 200 with raw text body `OK`.

### 3. 10% Service Charge (SC) Tip Pool Point Distribution Formula
- **Pool Accumulation:** Every room night, restaurant meal, and laundry bill automatically routes 10% SC into the monthly pool.
- **Distribution Points:**
  - Trainee / Dishwasher: 1.0 Pt
  - Room Attendant / Waiter: 1.5 Pts
  - Front Desk Agent / Chef de Partie: 2.0 Pts
  - Department Head: 3.0 Pts
- **Formula:** $\text{Staff SC Share} = \frac{\text{Total SC Pool}}{\sum (\text{Staff Points} \times \text{Days Worked})} \times (\text{Staff Points} \times \text{Days Worked})$.
- Attendance days are derived directly from biometric punch logs.

### 4. B2B Tour Operator Masked Calendar Privacy Law (`/partner`)
- When Agent **Yangphel** logs in:
  - Can view their own bookings with guest names and room numbers.
  - Competing agency bookings (e.g., *Druk Asia, BTCL*) MUST be masked as `"Occupied · Tour Group"`, hiding guest names, agent identities, and negotiated rates.
  - Vacant rooms show contracted B2B tier rates.

### 5. Dual-Folio Engine & Checkout Gate Invariant
- **Master Folio:** Room charges + MAP meal plans billed to Tour Operator credit (30-day MoU).
- **Personal Folio:** Extra food & beverage, minibar, laundry billed to guest.
- **Gate Invariant:** System strictly blocks checkout if `Personal Balance > Nu. 0.50`, even if the agency Master Folio has Nu. 200,000 pending.

### 6. Royal Bhutan Police & Immigration Tourist Manifest
- Formatted daily export for RBP and Department of Immigration: Guest CID/Passport, nationality, visa entry stamp, guide license number, and vehicle plate number.

---

## 3. Database Schema Deliverables (`v2/packages/db/src/schema.ts`)
Add the following enterprise tables to schema `v2`:
1. `procurement_advances` & `procurement_bills` (CFM cash sync).
2. `attendance_punches` & `shifts` (ZKTeco iClock protocol).
3. `sc_tip_pool_runs` & `sc_tip_pool_lines` (Monthly tip distribution).
4. `utility_meters` & `utility_bills` (BPC electricity, telecom, water, waste).
5. `amc_contracts` & `amc_service_logs` (Elevator, generator, boiler, exhaust).
6. `tour_guides`, `fleet_vehicles`, and `driver_dorm_beds` (Logistics).
7. `bank_statements` & `bank_statement_lines` (BoB mBoB QR, BNB, Druk PNB).
8. `dot_star_audits` & `dot_star_criteria` (DoT certification).

---

## 4. Desk Modules to Deepen (`v2/apps/desk/src/modules/`)
1. **Purchases (`PurchasesPage.tsx`):** Centenary Farmers Market cash advance drawer, veg/meat/dairy grids, receipt upload.
2. **HR & Attendance (`HrPage.tsx`):** Biometric punch stream, shift rover, 10% SC tip pool run generator, Bhutanese salary sheet (NPPF 11%, GIS, CIT).
3. **Utilities & AMC (`UtilitiesPage.tsx` & `AmcPage.tsx`):** BPC power meter unit tracking, telecom leased lines, Schindler/Mitsubishi lift AMC contract alerts.
4. **Registry & Logistics (`RegistryPage.tsx`):** Tour guide TCR verification, transport fleet scheduling, driver dorm bed rack.
5. **Bank Recon (`BankReconPage.tsx`):** 3-Bank CSV/Excel reconciliation for BoB mBoB QR, BNB, and Druk PNB.
6. **Partner Portal (`PartnerPortalPage.tsx`):** Masked calendar implementation enforcing B2B privacy law.

---

## 5. Verification Invariants
- `pnpm --filter @hos-v2/desk typecheck` must pass with 0 errors.
- `pnpm --filter @hos-v2/desk build` must produce a clean production bundle.
- Zero mock or phantom stores: all modules must bind to typed contracts.
