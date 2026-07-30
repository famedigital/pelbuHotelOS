# Cursor plans index

Plans live outside the repo at `C:\Users\rajiv\.cursor\plans\` (Cursor plan-mode artifacts). This file is the **in-repo status mirror** so agents and humans know what shipped vs what’s open.

Last reconciled: **2026-07-30**.

| Plan file | Focus | Status |
|-----------|--------|--------|
| `pelbu_suites_platform_b32472a0.plan.md` | Master platform phases P0–P6 | Core P0–P4 done; P5/P6 todos stale vs FEATURES (HR/inventory/channel foundation shipped) |
| `calendar_drag_booking_64bad6ba.plan.md` | Full-bleed Cloudbeds-style rack | **v1 + v1.5 + v2 core DONE**; v2 leftovers + v3+ catalog open |
| `erp_shadcn_reskin_d79ac669.plan.md` | ERP **Sky & Citrus** shadcn reskin (final palette) | **Done** — all 13 clusters |
| `erp_settings_page_41e5deb4.plan.md` | `/erp/settings` tabs: Identity · Tax & service · Documents · Rooms | **Done** |
| `hotel_erp_gap_p8_lists_p9_depth.plan.md` | P8 list pages + P9 depth modules | **Done** |
| `fast-book_ux_rebuild_dad84d1f.plan.md` | Fast-book three-zone UX | **Done** |
| `stay_dates_ux_upgrade_16852ef3.plan.md` | `StayDatesField` | **Done** |
| `guest_origin_+_conditional_guide_8e4bf3d0.plan.md` | `guest_origin` + guide rule | **Done** |
| `guide_&_driver_partners_e7f31b2c.plan.md` | Guides/drivers master | **Done** |
| `hold_ttl_multi-hotel_4326f6f0.plan.md` | Holds TTL + multi-property wizard | **Done** |
| `shadcn_ui_adoption_+_brand_evolution_32d29593.plan.md` | shadcn adopt + brand brief | **ERP primitives DONE**; public brand evolution open |
| `stripe_ace_shadcn_ui_24b7e356.plan.md` | Airbnb book + Mews Timeline + Pelbu-pink | **Largely superseded** — Timeline shipped via calendar plan; nav shipped as **Sidebar**; **Pelbu-pink retired** in favour of Sky & Citrus. Only the Airbnb `/book` funnel idea survives |
| `ui_arch_compact_592f39c6.plan.md` | UI arch record + polish tail | Open: POS density, agents card, voucher PDF, partner perks |
| `advanced_hotel_hr_a72c26d2.plan.md` | Advanced HR suite | **In progress** (schema foundation started) |
| `public_luxury_reskin_2028eb54.plan.md` | Public engines + Work PWAs + RBAC + search content | **P0–P4 implementation done; UAT remains** |
| `product-style_public_site_c97aee11.plan.md` | Earlier public product-style rebuild | Superseded by `public_luxury_reskin_2028eb54` |
| `product_ui_public_rebuild_9718f4ad.plan.md` | Earlier public product UI | Superseded by `public_luxury_reskin_2028eb54` |
| `live_booking_+_mockup_fidelity_248b4074.plan.md` | Live `/book` + mockup fidelity | Functional funnel and visual engine shipped |
| `crm_production_hardening_5aaaec43.plan.md` | Unrelated CRM (other product) | Ignore for Pelbu |

## Canonical docs

- Shipped routes / remaining work → [FEATURES.md](FEATURES.md)
- Architecture + phases → [PLATFORM.md](PLATFORM.md)
- Go-live tests → [UAT-CHECKLIST.md](UAT-CHECKLIST.md)

## ERP truth (2026-07-29)

The **current desk ERP** is the latest documented surface:

- Palette: **Sky & Citrus — FINAL** (sky-500 `#0ea5e9` + amber-500 `#f59e0b`). Pelbu-pink retired.
- Shell: `DeskShell` + **shadcn `Sidebar`** (`app-sidebar.tsx`) — not the older long `DeskHeader` wrap, and **not** the hamburger-`Sheet` originally sketched in P5.6
- Default home intent: **`/erp/calendar`** (full-bleed room rack)
- Settings: **`/erp/settings`** (identity, tax, document designs, rooms)
- Calendar plan leftovers / v3+ stay in `calendar_drag_booking_64bad6ba.plan.md` only — pull when desk asks
