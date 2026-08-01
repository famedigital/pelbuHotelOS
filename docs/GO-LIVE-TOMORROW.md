# Go-live briefing — Pelbu Suites Olakha

**Date:** 2026-08-02 (day 1 ops)  
**Property:** `pelbu-suites-olakha` (template 1)  
**Audience:** Reception, HK, F&B, Laundry, Manager, GM, Owner

This is the practical shift guide — not marketing. Read once with the team before the first guest arrives.

---

## 1. How everyone signs in

| Role | Where | Login |
|------|-------|--------|
| **Reception / Manager / GM / Owner** | Desk ERP | `/erp/login` — shared **desk PIN** (`DESK_PIN` in Vercel env). Staff with **desk access** can also use employee code + PIN (same session). |
| **Housekeeping** | Desk (limited) or staff app | `/staff/login` — employee code + PIN. HK board: `/staff/laundry` if doing laundry scans; room status on `/erp/rooms` when given desk PIN. |
| **F&B / Cafe / Bar** | POS + KDS | Desk PIN at `/erp/login` → **POS** (`/erp/pos`) and **Kitchen** (`/erp/kds`). Open a **POS shift** before taking cash/card. |
| **Laundry maid** | Staff laundry board | `/staff/login` → `/staff/laundry` — scan bag QR, confirm counts, advance status. |
| **Guest laundry** | Guest phone | `/laundry` — room number + guest name (in-house only). |

**Tip:** Press **⌘K** (Mac) or **Ctrl+K** (Windows) anywhere in the desk to jump to a screen. Header also has a **Search ⌘K** button.

---

## 2. Routes by role (day 1)

### Reception (front desk)

| Task | Route |
|------|-------|
| Room rack / calendar | `/erp/calendar` |
| Arrivals | `/erp/arrivals` |
| Check-in | `/erp/check-in` |
| In-house list | `/erp/in-house` |
| Check-out | `/erp/check-out` |
| Guest folio | `/erp/folios/{id}` (from calendar or in-house) |
| Fast walk-in book | `/erp/fast-book` |
| Guest laundry intake | `/erp/laundry` |
| Payments list | `/erp/payments` |

### Housekeeping

| Task | Route |
|------|-------|
| Room status (clean / dirty / inspect) | `/erp/rooms` |
| HK tasks | `/erp/housekeeping` |
| Maintenance tickets | `/erp/maintenance` |

### F&B / Cafe / Bar

| Task | Route |
|------|-------|
| POS cashier | `/erp/pos` |
| Kitchen display | `/erp/kds` |
| Menu admin | `/erp/menu` |
| Open tickets / online orders | `/erp` (dashboard inbox) |

**POS flow:** Open shift → build ticket → settle (cash/card/room charge) → close shift at end of service. Room charge posts to the guest folio immediately — verify on folio before checkout.

### Laundry

| Task | Route |
|------|-------|
| Desk intake + print bag QR | `/erp/laundry` → order → **Print bag QR** (`/erp/laundry/orders/{id}/labels`) |
| Staff board + scan | `/staff/laundry` |
| Guest self-service | `/laundry` |

If bag auto-prep fails (“no staff on file”), order is still created — open the order and print labels after adding a staff member under **HR**.

### Manager

| Task | Route |
|------|-------|
| **Night audit (close day)** | `/erp/night-audit` |
| POS Z-reports | `/erp/night-audit` (scroll to POS daily Z-reports) |
| Tax invoices issued | `/erp/invoices` |
| GST / finance | `/erp/gst`, `/erp/finance` |
| Reports | `/erp/reports` |
| Settings (GST %, logo) | `/erp/settings` |

### GM / Owner

Everything Manager has, plus:

| Task | Route |
|------|-------|
| Agents & credit | `/erp/agents` |
| HR / staff | `/erp/hr` |
| Property settings | `/erp/settings` |
| Group view | `/erp/group` |

---

## 3. Empty folio — expected until night audit

When a guest **checks in**, Pelbu opens an **empty folio** (balance Nu 0, “No lines yet”). **Room rent is not posted at check-in.**

Room nights post at **night audit**:

- **Automatic:** cron at **midnight Thimphu** (`0 18 * * *` UTC) — requires `CRON_SECRET` on Vercel.
- **Manual:** Manager runs **Close day** on `/erp/night-audit` (once per business date).

Until then, POS / laundry / desk charges still post normally. Only **room rent** waits for the roll.

**Checkout:** Use `/erp/check-out` — settle folio (zero balance or manager override with reason) before confirming departure.

---

## 4. Night audit — manager checklist

**Before you run:**

1. Close all **open POS shifts** (settle or void every ticket).
2. Scan **in-house folios** — take payments or post comps if needed.
3. Confirm **HK room statuses** on departures (dirty/clean).

**Run:** `/erp/night-audit` → pick business date → **Complete night audit**.

**Success message shows:**

- Sellable + comp occupancy counts  
- Room nights posted (or skipped if already posted)  
- Open folio count  
- Day charges vs payments (Nu)  
- Hotel backup emailed/stored (best-effort — audit still succeeds if email fails)

**Hotel backup:** every successful run emails a confidential Excel pack (`NOTIFY_DESK_EMAIL` / `OPS_BACKUP_EMAIL`) and stores it. Use **Download hotel backup** on the same page anytime (or from History). Save to USB/phone. Import-into-clean-property is a future tool (`pack_version 1` contract).

**If it fails:** read the error — room-night errors block the save. Fix the folio/booking issue and re-run (same date only if prior run did not complete).

**History** on the same page lists past runs with room-night counts + download links.

---

## 5. Laundry — print bag QR

1. Desk: `/erp/laundry` → select checked-in room → add garments → submit.  
2. On success, open **Print bag QR** (or `/erp/laundry/orders/{id}/labels`).  
3. Stick label on bag; maid scans at `/staff/laundry`.  
4. Maid confirms counts → folio charge posts once (atomic).  
5. Cancel / void from desk reverses folio + journal.

**Empty catalog:** Use **Add cloth type** on the intake tab, or add prices under laundry catalog. Seed migration fills 13 Pelbu items when catalog is thin.

---

## 6. Invoices vs folios

| Screen | What it is |
|--------|------------|
| **Folio** (`/erp/folios/{id}`) | Running guest account — charges, payments, balance. |
| **Tax invoices** (`/erp/invoices`) | **Issued fiscal numbers only** (`INV-YYYY-####`). Issue from folio via **Issue tax invoice** — not automatic on checkout. |
| **Receipt** | Print from folio → `/erp/folios/{id}/receipt` after **Issue receipt** (RCP-YYYY-####). |

This is **not** the Bhutan RRCO e-invoice API yet — internal sequences for front-office paperwork.

---

## 7. Security — do before go-live

### Leaked-password protection (SEC-03)

In **Supabase Dashboard** → **Authentication** → **Providers** → **Email** (or Auth settings → Security):

- Enable **Leaked password protection** (Have I Been Pwned check).

Cannot be toggled from app code — owner must click once in Supabase.

### Desk PIN

- Rotate `DESK_PIN` if it was ever shared in chat.  
- Only managers get manager PIN for voids / period override (`POS_MANAGER_PIN` or settings).

---

## 8. Known deferred (not day 1)

| Item | Why deferred |
|------|----------------|
| **PL-01** Host white-label / multi-tenant routing | Single-hotel go-live; see `MULTI-TENANT-WHITELABEL.md` |
| **SEC-01** Full purge of service-role desk reads | Pilot `assertDeskProperty` only; full rewrite is Phase C |
| **BTCL chain CRS** | See `BTCL-ADAPTATION.md` |
| **Branded RRCO e-invoice API** | Fiscal sequences shipped; API + PDF polish later |
| **Channex OTA** | Foundation UI only — do not rely on live channel sync day 1 |
| **Calendar Realtime** | Poll refresh only — refresh browser if rack looks stale |

---

## 9. Morning briefing script (5 minutes)

1. “Desk login is `/erp/login`. Calendar is home.”  
2. “Check-in opens folio — **room rent posts at night audit**, not at arrival.”  
3. “F&B: open POS shift, settle tickets, room charge hits folio.”  
4. “Laundry: desk creates order → print bag QR → maid scans.”  
5. “Manager: run night audit after service; check message for room-night count.”  
6. “Tax invoice numbers only after **Issue tax invoice** on folio — `/erp/invoices` lists them.”  
7. “⌘K / Ctrl+K to jump anywhere.”

---

## 10. Support contacts

- **Technical / Cursor owner:** check Vercel deploy + Supabase logs if cron or payments fail.  
- **UAT scripts:** `docs/UAT-CHECKLIST.md`  
- **Fault register:** `docs/ERP-AUDIT.md`

Good luck — the money paths are gated; if something looks wrong on a folio, stop and ask Manager before checkout.
