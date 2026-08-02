# Cursor plans index (combined → v1)

Plans live outside the repo at `C:\Users\rajiv\.cursor\plans\` (Cursor plan-mode artifacts).  
**Release roll-up:** [RELEASE-v1.md](RELEASE-v1.md).  
**Shipped routes:** [FEATURES.md](FEATURES.md).

Last reconciled: **2026-08-03** (wave + post-wave on main through `9d3fe3f`; N+1 tranche StayHub/NA/HR/DOT/kitchen/journals quality-gated and pushed; residual A/B/C queue).

---

## Active / recommended queue (in progress)

| Plan | Focus | Status | Saved copy |
|------|--------|--------|------------|
| **Way forward (current)** | Residual after wave + N+1 — **A finish** journals UAT + Playwright → **B** FO friction → week packs | **In progress** | [plans/olakha-erp-way-forward.md](plans/olakha-erp-way-forward.md) |
| N+1 tranche (shipped) | StayHub FO cycle, night-audit desk, HR personnel/rota cover, kitchen events, hotel accountant/journals, DOT assessment | **Done (pushed)** — see way-forward §1.3 | same way-forward doc |
| `rates_meals_nationality_7c9e2c95.plan.md` | Production-ready #1 ERP wave | **Done (implementation)** — 50/71; residual in way-forward | [plans/olakha-production-ready-erp-wave.md](plans/olakha-production-ready-erp-wave.md) |

**Wave 0–6 + post-wave (laundry, rack desks, inventory module, rates sheet, day-1 folio):** done on `main`. **N+1:** StayHub system-of-record + NA/HR/finance/kitchen/DOT. **Next:** Phase A finish (Playwright) → Phase B (PDF/export/minibar/fees). Do not restart the 71-todo wave.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Done** | Shipped in product for Olakha v1 |
| **Done / residual** | Code shipped; human/ops or optional polish remains |
| **Superseded** | Replaced by a later plan — do not implement |
| **Open / post-v1** | Explicitly out of v1 or deal-triggered |
| **Ignore** | Other product / not Pelbu |

---

## Master / maturity

| Plan file | Focus | Status |
|-----------|--------|--------|
| `pelbu_suites_platform_b32472a0.plan.md` | Master P0–P6 | **Done** for boutique core; P6 live Channel = residual |
| `pelbu_98_maturity_roadmap_fbefefb9.plan.md` | Waves 0–4 → ~98 single-hotel | **Done** in code; launch checklist / cert = owner |
| `refresh_maturity_canvas_0b5287b7.plan.md` | Maturity canvas refresh | **Done** (docs/audit) |
| `phase_b_sprint_roadmap_fe38d3ad.plan.md` | Phase B money sprint | **Done** |
| `beat_ezee_ids_gaps_b5019edc.plan.md` | Beat eZee/IDS + competitive gaps | **Done** / residual cert + SaaS Stripe |
| `erp_browser_audit_40c2e6c5.plan.md` | ERP HTTP crawl audit | **Done** / Playwright click-through optional |

---

## Desk shell, settings, calendar

| Plan file | Focus | Status |
|-----------|--------|--------|
| `erp_shadcn_reskin_d79ac669.plan.md` | Sky & Citrus ERP reskin | **Done** |
| `erp_desktop_shell_0ed91b39.plan.md` | Desktop shell polish | **Done** |
| `erp_settings_page_41e5deb4.plan.md` | `/erp/settings` tabs | **Done** |
| `calendar_drag_booking_64bad6ba.plan.md` | Full-bleed room rack | **Done** (v1–v2 + leftovers used) |
| `calendar_rack_density_a3073dd1.plan.md` | Rack density | **Done** |
| `dense_calendar_room_headers_e50f81f0.plan.md` | Dense room headers | **Done** |
| `rack_room_identity_80f8eb92.plan.md` | Room identity on rack | **Done** |
| `rack_bars_and_hover_220e67c2.plan.md` | Stay bars, hover, voucher, shells | **Done** |
| `hotel_erp_gap_p8_lists_p9_depth.plan.md` | P8 lists + P9 depth | **Done** |

**Post-v1 optional (pull when desk asks):** overbooking buffer, stop-sell markers, rooming-list editor, VIP intel, full keyboard rack — still listed in FEATURES calendar leftovers.

---

## Front office, book, agents

| Plan file | Focus | Status |
|-----------|--------|--------|
| `bhutan_front_desk_flow_c629d551.plan.md` | Bhutan FO flow | **Done** |
| `check-in_guest_table_1129ac18.plan.md` | Dense guest docs | **Done** |
| `fast-book_ux_rebuild_dad84d1f.plan.md` | Fast-book UX | **Done** |
| `stay_dates_ux_upgrade_16852ef3.plan.md` | `StayDatesField` | **Done** |
| `guest_origin_+_conditional_guide_8e4bf3d0.plan.md` | Guest origin + guide | **Done** |
| `guide_&_driver_partners_e7f31b2c.plan.md` | Guides/drivers | **Done** |
| `hold_ttl_multi-hotel_4326f6f0.plan.md` | Holds + multi-property | **Done** |
| `searchable_agent_picker_21182a58.plan.md` | Agent picker + create | **Done** |
| `agent_dossier_reports_2da2e2d7.plan.md` | Agent dossier + reports catalog | **Done** (Phase C cost trends **Open / post-v1**) |
| `a4_luxury_itinerary_ddb107d6.plan.md` | Luxury itinerary print | **Done** / polish as needed |

---

## POS, laundry, F&B

| Plan file | Focus | Status |
|-----------|--------|--------|
| `pos_modernization_e6b44a97.plan.md` | Modern POS | **Done** |
| `pos_unify_online_82c9563e.plan.md` | Online + desk POS | **Done** |
| `pos_stock_and_closing_9522e8db.plan.md` | Stock + shift close | **Done** |
| `pos_ticket_panel_sizing_7a50881c.plan.md` | Ticket panel sizing | **Done** |
| `order_board_redesign_28ead83f.plan.md` | Order / KOT board | **Done** |
| `dynamic_outlet_management_f1ba018d.plan.md` | Outlets | **Done** |
| `guest_laundry_module_67cbcced.plan.md` | Guest laundry | **Done** |
| `laundry_bag_tracking_b401edd2.plan.md` | Bag QR CoC | **Done** |

---

## Finance, HR, channel, SaaS

| Plan file | Focus | Status |
|-----------|--------|--------|
| `modern_finance_ledger_c170f5fe.plan.md` | Double-entry ledger | **Done** |
| `finance_import_workbench_0bfcc416.plan.md` | Import workbench | **Done** |
| `advanced_hotel_hr_a72c26d2.plan.md` | Advanced HR | **Done** boutique; chain-scale **Open / post-v1** |
| Channel / ARI (in maturity + beat plans) | Desk ARI | **Done / residual** live cert |
| White-label / tenants (wave 4) | Host + tenants foundation | **Done / residual** Stripe + domains |

---

## Public site + PWA

| Plan file | Focus | Status |
|-----------|--------|--------|
| `public_luxury_reskin_2028eb54.plan.md` | Public engines + Work PWAs | **Done** (UAT owner) |
| `public_site_redesign_f5d4a37b.plan.md` | Earlier redesign | **Superseded** |
| `product-style_public_site_c97aee11.plan.md` | Product-style public | **Superseded** |
| `product_ui_public_rebuild_9718f4ad.plan.md` | Product UI rebuild | **Superseded** |
| `live_booking_+_mockup_fidelity_248b4074.plan.md` | Live `/book` | **Done** |
| `hero_booking_widget_a85acf83.plan.md` | Hero search widget | **Done** |
| `mega_menu_offerings_2a8202ef.plan.md` | Mega menu offerings | **Done** |
| `fix_splash_dom_crash_874ea873.plan.md` | Splash crash fix | **Done** |
| `first_login_wizard_a834afbb.plan.md` | First-login wizard | **Done** / as shipped |

---

## UX / brand evolution (historical)

| Plan file | Focus | Status |
|-----------|--------|--------|
| `shadcn_ui_adoption_+_brand_evolution_32d29593.plan.md` | shadcn + brand | ERP **Done**; public via luxury reskin |
| `stripe_ace_shadcn_ui_24b7e356.plan.md` | Airbnb + Mews + pink | **Superseded** — pink retired; Timeline via calendar; Sidebar shipped |
| `ui_arch_compact_592f39c6.plan.md` | UI arch + polish tail | Mostly **Done**; branded PDF voucher **Open / post-v1** |

---

## Ignore

| Plan file | Why |
|-----------|-----|
| `crm_production_hardening_5aaaec43.plan.md` | Unrelated CRM product |

---

## Canonical docs

| Doc | Role |
|-----|------|
| [plans/olakha-erp-way-forward.md](plans/olakha-erp-way-forward.md) | **Current residual queue + phases** |
| [plans/olakha-production-ready-erp-wave.md](plans/olakha-production-ready-erp-wave.md) | Wave 0–6 snapshot |
| [RELEASE-v1.md](RELEASE-v1.md) | Combined v1 release picture |
| [FEATURES.md](FEATURES.md) | Shipped vs remaining |
| [WHITEBOARD.md](WHITEBOARD.md) | Live system map |
| [ERP-AUDIT.md](ERP-AUDIT.md) | Fault register |
| [GO-LIVE-TOMORROW.md](GO-LIVE-TOMORROW.md) | Day-1 shift guide |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | Cutover env + smoke |
| [PLATFORM.md](PLATFORM.md) | Architecture north star |
