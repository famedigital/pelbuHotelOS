# Hotel OS Master Enterprise Upgrade Execution Plan

> **Audience:** Cursor Composer, Implementer AI Agents, Senior Systems Engineers.  
> **Mandate:** Execute the full Hotel OS upgrade from database kernel to frontend glassmorphism. Follow these specifications strictly. Every code change must be 100% production-ready, typed, and wired from Ground Zero ("Code 0"). No stubs, no placeholders, no fake mock arrays.

---

## 1. Execution Order & Pipeline

Cursor must execute the following 6 phases sequentially:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: FINANCIAL ATOMICS & DATABASE INDEXES (Kernel Safety)          │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: BASE PALETTE CLEANUP & TOP-NOTCH DESIGN TOKENS (UI Theme)     │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: STAYHUB & CENTRAL INVOICING DECOMPOSITION (Ops Workflow)      │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: MOBILE & TABLET REDESIGN ACROSS ERP (Ergonomics)              │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: SUPER ADMIN PLATFORM CONTROL PLANE (/admin)                   │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 6: HERMES TELEGRAM OPERATING ENGINE (Messaging)                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Technical Specifications

### Phase 1: Financial Atomics & Database Indexes
1. **Performance Indexes Migration (`supabase/migrations/20261103_enterprise_perf_indexes.sql`):**
   ```sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stays_perf_timeline
   ON stays (property_id, check_in_date, check_out_date, status);

   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folio_charges_perf_stay
   ON folio_charges (stay_id, is_voided, created_at DESC);

   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_property_category
   ON rooms (property_id, category_id, is_active);
   ```
2. **Atomic Checkout Stored Procedure (`supabase/migrations/20261103_stayhub_atomic_checkout.sql`):**
   - Create `stayhub_checkout_atomic(p_property_id UUID, p_stay_id UUID, p_cashier_id UUID, p_idempotency_key UUID)`.
   - Validate idempotency key.
   - Lock stay row with `SELECT ... FOR UPDATE`.
   - Verify net folio balance $\le 0.01$.
   - Atomically increment `property_sequences` for gapless `INV-YYYY-XXXXX`.
   - Transition `stays.status = 'checked_out'` and `rooms.housekeeping_status = 'dirty'`.

---

### Phase 2: Base Palette Clean-up & Top-Notch Design Tokens
1. **Clean `web/src/app/globals.css`:**
   - Remove legacy earthy mud colors (`#f6f4f1`, `#8e2f2b`, `#1a1816`, `#5c564e`).
   - Set `.erp` base tokens:
     * `--background: #F8FAFC;` (Crisp clean porcelain in light mode).
     * `--foreground: #0F172A;` (Deep midnight slate).
     * `--muted-foreground: #64748B;` (Cool slate).
     * `--border: rgba(226, 232, 240, 0.85);` (Subtle ice border).
     * In `.dark`, set `--background: #090D16;` and `--foreground: #F8FAFC;`.
2. **Deploy Universal 3D Glass & Neo Tokens:**
   - Deploy `.top-notch-card`: Frosted 16px blur with 1px specular top rim and subtle elevation shadow.
   - Deploy `.top-notch-well`: Tactile sunken inset well for progress bars and search inputs.
   - Deploy `.top-notch-btn`: Tactile 3D button that scales down (`active:scale-97`) with subtle click depression.
   - Deploy glowing semantic status badges:
     * `.badge-clean`: Emerald (`#059669`) with soft mint glow.
     * `.badge-dirty`: Coral/Ruby (`#E11D48`) with urgency glow.
     * `.badge-vip`: Sovereign Gold (`#D97706`) with warm amber glow.
     * `.badge-lapis`: Sky Lapis (`#0284C7`) for active in-house stays.
3. **Remove Blanket CSS Overrides:**
   - Remove global `.erp [data-slot="card"]` and `.erp [data-slot="button"]` thick double-shadow rules that cause visual clutter on small utility components.

---

### Phase 3: StayHub & Central Invoicing Decomposition
1. **Deconstruct `web/src/components/erp/StayHubDialog.tsx`:**
   Split the 5,000-line monolith into 4 modular sub-components:
   - `StayHub3DShell.tsx`: Container with `.top-notch-card`, spring open animation, and `Esc` / `Ctrl+P` shortcuts.
   - `StayHubHeaderBar.tsx`: Guest name, room number pill, VIP/Agent badge, and live net balance display.
   - `StayHubDualLedger.tsx`: Dual-stream A/B ledger (Tab A: Agent Room Voucher vs Tab B: Guest Personal Extras).
   - `StayHubCashierDock.tsx`: Floating action dock with 1-click Bhutan RMA QR code generation and checkout execution via `stayhub_checkout_atomic`.

---

### Phase 4: Mobile & Tablet Redesign Across All ERP Routes
1. **Calendar Agenda (`/erp/calendar`):**
   - Verify `MobileDayAgenda.tsx` renders on screens `< 768px` with swipeable 7-day date pills and touch KPI summary.
2. **Arrivals & In-House (`/erp/arrivals`, `/erp/in-house`):**
   - On mobile (`< 768px`), hide wide tables (`hidden md:table`) and display responsive touch cards (`block md:hidden`).
   - On tablets (`768px - 1024px`), implement a 2-column split view (35% guest list / 65% stay details and action dock).
3. **Touch Ergonomics:**
   - Enforce minimum 44px $\times$ 44px hitboxes for all interactive elements.
   - Set `font-size: 16px` on inputs to prevent iOS Safari auto-zooming.
   - Set `inputMode="numeric"` on PIN, phone, and monetary inputs.

---

### Phase 5: Super Admin Platform Control Plane (`/admin`)
1. **Database Migration (`supabase/migrations/20261103_super_admin_core.sql`):**
   - Create `platform_admins` table with RLS enabled.
   - Add security definer function `is_platform_super_admin()`.
2. **Middleware Guard (`web/src/middleware.ts`):**
   - Intercept `/admin` routes. Verify `platform_admins` role. Redirect unauthorized users to `/admin/login`.
3. **Admin Dashboard Views (`web/src/app/admin/`):**
   - `page.tsx`: Global fleet metrics (Active hotels, in-house guests, 24h revenue, DRC tax health).
   - `properties/page.tsx`: Directory of all tenant properties with domain routing and active product packs.
   - Server Action `provisionHotelAction`: Atomically provisions a new property, seeding sequences, meal plans (EP/CP/MAP/AP), and standard room categories.

---

### Phase 6: Hermes Telegram Operating Engine (Replacing WhatsApp)
1. **Core Service (`web/src/lib/hermes-telegram.ts`):**
   - Implement `sendHermesTelegram({ chatId, threadId, text, buttons })` using the official Telegram Bot API.
2. **Topic Routing:**
   - Map hotel operations to Telegram supergroup forum topics:
     * `#front-office` (New bookings, check-ins, VIP arrivals)
     * `#housekeeping` (Turnover alerts with inline `[Mark Clean]` button)
     * `#kitchen-pos` (Dining tickets with `[Preparing]` / `[Delivered]` buttons)
     * `#management-audit` (Night audit roll report, rate override approvals)
     * `#drivers-guides` (Group arrival briefings, parking logistics)
3. **Two-Way Webhook Handler (`web/src/app/api/telegram/webhook/route.ts`):**
   - Handle callback queries for instant action execution (e.g. `hk_clean:<room_id>`).
   - Handle text commands: `/today`, `/occ`, `/clean <room>`, `/search <name>`.
4. **Deprecate CallMeBot:**
   - Remove CallMeBot functions in `web/src/lib/notify.ts` and redirect notification triggers to Hermes Telegram.

---

## 3. Strict Pre-Completion Verification Checklist

Before marking any task as complete, Cursor must pass this verification:
1. [ ] **TypeScript Check:** `pnpm --dir web run typecheck` passes with **0 errors**.
2. [ ] **No Stubs:** No `// TODO: implement later` or dummy mock arrays in production paths.
3. [ ] **Multi-Tenancy Guard:** Every query and action enforces `property_id` scoping.
4. [ ] **Smoke Tests:** `pnpm --dir web run test:e2e:smoke` passes without regression.
