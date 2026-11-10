# Hotel OS v2 — Implementation status (clean rebuild)

**Product home:** top-level [`v2/`](../../v2/) (separate pnpm workspace).  
**Canonical specs:** [`MODULES.md`](./MODULES.md) · [`SOURCE-MAP.md`](./SOURCE-MAP.md) · [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) · [`UX-GUARDRAILS.md`](./UX-GUARDRAILS.md) · [`OPERATIONS-FLOW.md`](./OPERATIONS-FLOW.md) · [`AGENT-PORTAL.md`](./AGENT-PORTAL.md) · [`adr/001-separate-v2-schema.md`](./adr/001-separate-v2-schema.md)

**Live FO today:** Innora `web/` `/erp/*` until `V2_DESK_CUTOVER=true` after shadow ([`CUTOVER.md`](./CUTOVER.md)).

**Root `apps/*` + root `packages/*`:** frozen **reference**. Do not extend. Do not runtime-import into `v2/`.

---

## Thin-page ban + module-done gate

Reject any module that is only a route + title + mock/placeholder table.

A module is **done** only when all of these are true:

1. Write flows (commands)
2. Permission keys
3. Audit entries
4. Emits and handles its events ([MODULES](./MODULES.md) event map)
5. Live updates
6. Tablet/phone layout
7. Domain tests on money paths (when applicable)
8. Its journey segment in [`OPERATIONS-FLOW.md`](./OPERATIONS-FLOW.md) passes

---

## Tranche status (2026-11-08)

| Tranche | Status | Notes |
|---|---|---|
| **1** Deep docs + `v2/` scaffold | **Done** | SOURCE-MAP, MODULES (31), journeys, portal, UX, Glacier v2.1, ADR 001, skills, workspace |
| **2** Phase 2 spine | **Done** | domain COPY tax/numbering/dates/PIN + tests; Drizzle + SQL migration; command/outbox; Glacier desk shell (9 groups); drafts-only sync; hardware interfaces |
| **Wave A–H commands** | **In tree** | Typed commands in `v2/apps/api/src/modules/wave-*.ts` |
| **Wave A deep UI** | **In tree** | Settings / HR / Rates |
| **Wave B deep UI** | **In tree** | Desk (live board) · Reservations + Fast Book · StayView rack · StayHub drawer · Guests · Groups · Night Audit |
| **Glacier FO UI rebuild** | **Done (flagship)** | Tailwind v4 + Motion + Radix/cmdk/vaul + TanStack Query/Table/Virtual + dnd-kit; kit in `@hos-v2/ui`; shell Ctrl+K; Desk/Reservations/StayHub/StayView premium glass — Settings/HR/Rates/Guests/Groups/Night Audit keep working on new shell chrome only |
| **Mobile + tablet redesign** | **Done (v2 desk)** | Phone floating glass dock; StaySheet bottom sheet; StayView date carousel + room cards; Reservations cards; Fast Book bottom sheet; ModuleFrame across Settings/Finance/HR/Rates/Guests/Groups/Night Audit/HK/POS/Laundry/Reports/Owner/Agents/Channel/Compliance/Purchases/Staff Portal + remaining ERP routes; tablet 60/40 Desk; TouchSensor; theme/print on phone |
| **Mobile/tablet from scratch** | **Done (v2 desk)** | Dedicated `*MobileView` for Desk / StayView / HK hallway / POS waiter; adaptive shell (phone top bar + 58px dock, tablet 64px icon rail, desktop 100vh cockpit); FastBook + StayHub via `vaul` bottom drawers; typecheck + build clean |
| **Butter motion UX** | **Done (v2 desk)** | `springButter` / `ButterCard` / sheen hover; route soft-scale `PageTransition`; ModuleFrame settle; dock layoutId pill; FO mobile/tablet stagger + press; KPI whileHover; reduced-motion safe |
| **iOS Clear UI (whole v2)** | **Done (tokens → desk)** | HIG-inspired system gray canvas, System Blue, opaque inset cards, large titles, edge tab bar, inset More sheet; `@hos-v2/ui` tokens cascade to all desk modules — see `docs/v2/IOS-CLEAR-UI.md` |
| **Enterprise ops schema A–E** | **Done (additive)** | CFM advances/bills/drawer, ADMS punches + shifts, SC tip pool, utilities/AMC, guides/fleet/dorms, bank statements+lines+matches in `0002`; completion `0004` (debit/credit, fingerprint, DoT star, dorm rates); `/iclock/cdata` + `finance.importBankStatement` + `finance.matchBankStatementLine` + procurement/tip commands |
| **Wave C–H deep UI** | **Not yet** | Sidebar stubs until each wave |
| **Blueprint gap close (L0–L5 desk path)** | **Done (2026-11-08)** | `CurrencyCell` / `LedBeacon` / `KeycapBadge`; desk J/K·C·O·X·?·⌘Z + sfx; 74px KPI ribbon; onboarding+spotlight tour mounted; dispatcher extend/post/floor-assign; offline idempotencyKey seal; police manifest API→local fallback. **Deferred:** Postgres `night_audit.run` cutover, Wave C–H deep UI |
| **FO production authority (Groups 1–4)** | **Done (memory + optional PG)** | API `finance.postCharge`/`postPayment` mutate folios + `voidLineWithReversal`; desk fail-closed lifecycle/money via ACK; single `night_audit.run` date writer; POS one `apiOrderId`; HK/laundry/registry/channel/agents wired; `fo-persist` dual-writes when `DATABASE_URL` set. **Does not** flip `V2_DESK_CUTOVER` — see [CUTOVER.md](./CUTOVER.md) go/no-go |
| **POS enterprise + Groups 1–4 P0 (2026-11-08)** | **Done (tranche 1→2)** | Touch-ops 3-zone POS till + mobile; KDS bump/recall fail-closed; `pos.settle` room_charge via `finance.postCharge`; HeldCheck `apiOrderId` park/resume; `night_audit.run` posts room nights via finance (fiscal pack tips/CSV only); PG boot hydrate + assign/void persist; desk folio hydrate prefers API lines; partner AR verify awaits `recordPayment`. **Cutover go/no-go still open** — flag stays false |
| **Hospitality ecosystem companions** | **Done (mobile-first)** | Spec [`HOSPITALITY-ECOSYSTEM-SPEC.md`](./HOSPITALITY-ECOSYSTEM-SPEC.md); Guide + Driver companions (`/ecosystem/*`); HK ≥48px hallway taps; waiter POS tip-pool widget; partner 48h MoU allotment + voucher PDF → master folio. Cutover flag still false |
| **Innora public homepage (enterprise)** | **Done** | Spec [`PUBLIC-HOMEPAGE-ENTERPRISE-SPEC.md`](./PUBLIC-HOMEPAGE-ENTERPRISE-SPEC.md); `v2/apps/web` obsidian glass marketing page — Broken Relay, 5-way ecosystem tabs, DRC engine, ROI calculator, authority footer. `pnpm --filter @hos-v2/web build` green |
| **FO OPERATIONS-FLOW §5.2 gate** | **Green locally (2026-11-09)** | Domain `fo-fit-journey` + desk Playwright book→assign→CI→doc scan→laundry→mBoB→CO→audit cockpit (5/5 with §5.5). Hardened StayHub selection across live hydrate (API booking id). `pnpm cutover:go-no-go` → **HOLD**. **`V2_DESK_CUTOVER` stays false** |
| **StayHub density + FO reliability** | **Done (2026-11-09)** | Compact identity+due chrome, one primary CTA, tenders in Folio; Fast Book/CI from `businessDate`; SSE CORS on `/v1/live/stream`; CI doc/ID gate; outbox→debounced folio hydrate with selection remap; Playwright §5.5 day-close |
| **Module-done** | **Not claimed** | Remaining §5.1/§5.3/§5.4 journeys + shadow diffs still open; cutover flag stays false |

### Verified locally

```bash
cd v2
pnpm install
pnpm --filter @hos-v2/domain test     # 9 pass (tax 5000→5775, all-in reverse, SC-exempt, PIN, numbering)
pnpm --filter @hos-v2/domain typecheck
pnpm --filter @hos-v2/db typecheck
pnpm --filter @hos-v2/api typecheck
pnpm --filter @hos-v2/desk typecheck
pnpm --filter @hos-v2/ui typecheck
pnpm --filter @hos-v2/sync typecheck
pnpm --filter @hos-v2/hardware typecheck
```

### FO gate commands

```bash
cd v2
pnpm --filter @hos-v2/domain test          # includes fo-fit-journey
pnpm cutover:go-no-go                      # HOLD until manual □s + e2e green; never flips flag
pnpm --filter @hos-v2/desk test:e2e:fo     # needs API :4200 + desk :5174 (reuses if up)
```

### Next execution (continue deep, not hollow)

1. Expand Playwright §5.1 agent group / §5.3 POS / §5.4 cancel; keep §5.2+§5.5 green on CI
2. Shadow diffs + finish CUTOVER manual □s (do **not** set `V2_DESK_CUTOVER` until green)
3. Dense Wave A UI against real PG queries; Wave B assign with row locks under load
4. Realtime outbox → desk folio delta after POS room charge (boot hydrate + REST enrich already land lines)

Doctrine: every PR cites a [SOURCE-MAP](./SOURCE-MAP.md) row. Never port Wave snapshot/RAM money. **Never flip `V2_DESK_CUTOVER` until CUTOVER go/no-go is green.**
