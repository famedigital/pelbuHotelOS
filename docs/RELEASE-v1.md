# Pelbu Suites OS — Release v1.0

**Status:** Ready for single-hotel production (Pelbu Suites Olakha, `template_id` 1).  
**Date:** 2026-08-01  
**Scope:** One property desk + public conversion PWA. Not full chain SaaS or live Channex certification.

This document **combines** the Cursor plan waves into one release picture. Detailed module tables stay in [FEATURES.md](FEATURES.md); fault register in [ERP-AUDIT.md](ERP-AUDIT.md); day-1 ops in [GO-LIVE-TOMORROW.md](GO-LIVE-TOMORROW.md).

---

## What v1 means

| Included | Explicitly deferred |
|----------|---------------------|
| Public book / order / laundry PWAs | Stripe self-serve multi-tenant billing |
| Desk ERP: calendar rack, FO, folio, POS, laundry CoC | Live Bhutan DRC e-invoice API |
| Night audit cron + close-time gate | Live Pay.bt merchant settle (desk-confirm OK) |
| Agents + credit + **360° dossier** + named reports | Purchase cost / MoM kitchen price trends (Phase C) |
| Finance ledger + bank recon + GST screens | Full RMS theoretical vs actual |
| HR / rota usable at boutique scale | 200-staff biometrics payroll |
| Channel desk ARI queue (code) | **Live** Channex cert (`CHANNEX_*` human step) |
| Host / tenants foundation | Domain automation + white-label polish |

**Operator gate before cutover:** complete [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) with **real initials** — env, Auth, smoke UAT.

---

## Combined plan → v1 outcome

Plans live at `C:\Users\rajiv\.cursor\plans\` and are mirrored in [PLANS.md](PLANS.md). Below is the release roll-up.

### Platform foundation
| Plan cluster | Outcome in v1 |
|--------------|---------------|
| `pelbu_suites_platform_*` + P0–P7 | Core hotel OS shipped |
| `pelbu_98_maturity_roadmap_*` waves 0–4 | Ops → Money → Others → WL foundation **shipped in code** |
| `beat_ezee_ids_gaps_*` + competitive gap close | Connecting rooms, loyalty lite, offline drafts, recipe cost, DRC stub |
| `phase_b_sprint_roadmap_*` | Money-path / fiscal hardening |

### Public + brand
| Plan cluster | Outcome in v1 |
|--------------|---------------|
| `public_luxury_reskin_*` / conversion rebuild | Himalayan Dusk public site + engines |
| `hero_booking_widget_*` + `/book` funnel | Airbnb-style hold + deposit path |
| `fix_splash_*` + Work manifests | Brand splash / PWA install |

### Desk shell + calendar
| Plan cluster | Outcome in v1 |
|--------------|---------------|
| `erp_shadcn_reskin_*` + `erp_desktop_shell_*` | Sky & Citrus Sidebar desk |
| `erp_settings_page_*` | Identity · Tax · Documents · Rooms |
| `calendar_drag_booking_*` + density / rack plans | Full-bleed room rack v1–v2 + density + connecting rooms |
| `rack_bars_and_hover_*` + stay-bar polish | Quieter bars, hover CTAs, ops colors, edit journey modal |
| `dense_calendar_room_headers_*` / `rack_room_identity_*` | Door / type / floor·view·balcony identity |

### Front office + F&B + laundry
| Plan cluster | Outcome in v1 |
|--------------|---------------|
| `bhutan_front_desk_flow_*` + check-in / checkout | SDF docs, `/erp/check-out`, arrivals boards |
| `fast-book_*` + `searchable_agent_picker_*` | Walk-in book + agent create sheet |
| POS / KOT / order-board plans | Modern POS, KDS, open tickets |
| `guest_laundry_*` + bag tracking | Guest + desk + staff laundry CoC |

### Money + people + channel
| Plan cluster | Outcome in v1 |
|--------------|---------------|
| `modern_finance_ledger_*` + import workbench | Double-entry + bank PDF import |
| `advanced_hotel_hr_*` | Staff / leave / rota (boutique) |
| Hold TTL / partners / guest origin | Bhutan FO rules |
| Channel ARI + `CHANNEX-CERT.md` | Desk ready; **cert open** |
| `agent_dossier_reports_*` | Agent dossier + reports catalog |

---

## Versioning

| Tag | Meaning |
|-----|---------|
| **v1.0** | This release — Olakha can run daily ops on Pelbu OS |
| **v1.x** | Polish, bugfix, optional rack leftovers when desk asks |
| **v2** | Live Channel cert + Pay.bt + Phase C cost history + deeper AuthZ purge |
| **v3** | Chain / BTCL / full white-label Stripe |

Suggested git tag when you cut: `v1.0.0` (owner creates after launch checklist sign-off).

---

## Residual checklist (not blockers for boutique v1)

1. [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) + [UAT-CHECKLIST.md](UAT-CHECKLIST.md)  
2. HaveIBeenPwned on Supabase Auth  
3. [CHANNEX-CERT.md](CHANNEX-CERT.md) when OTAs go live  
4. Retire `ALLOW_DESK_PIN_IN_PROD` once staff Auth covers the desk  
5. Phase C: write `unit_cost_btn` on every inventory receive before kitchen price reports  

See [WHITEBOARD.md](WHITEBOARD.md) §7 for the wave residual list.
