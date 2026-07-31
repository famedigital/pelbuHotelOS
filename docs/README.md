# Documentation index

All Pelbu OS docs live in this folder (`C:\GitHub\pelbusuites\docs`).

| Doc | Purpose |
|-----|---------|
| [WHITEBOARD.md](WHITEBOARD.md) | **Live system map** — surfaces, 9 ERP modules, hosting, known gaps |
| [ERP-AUDIT.md](ERP-AUDIT.md) | **International PMS fault register** + Phase A–C correction roadmap |
| [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md) | SaaS white-label, DNS/CNAME, Host → property routing |
| [BTCL-ADAPTATION.md](BTCL-ADAPTATION.md) | Multi-hotel chain adaptation (BTCL) |
| [FEATURES.md](FEATURES.md) | **Shipped vs remaining** — ERP calendar, Sidebar shell, settings, phases |
| [PLATFORM.md](PLATFORM.md) | Full Pelbu OS plan (architecture, UX north stars, phases) |
| [PLANS.md](PLANS.md) | **Cursor plans mirror** — status of every file in `C:\Users\rajiv\.cursor\plans\` |
| [UAT-CHECKLIST.md](UAT-CHECKLIST.md) | Go-live test checklist before Excel cutover |
| [IMAGE_SERVER.md](IMAGE_SERVER.md) | **Cloudinary** + MCP (chosen image CDN) |
| [CLAUDE.md](CLAUDE.md) | Claude agent handoff rules |
| [../.cursor/commands/zai-handoff-mews-pink-public.md](../.cursor/commands/zai-handoff-mews-pink-public.md) | z.ai Round 1 brief — **palette section outdated** (pink retired; use Sky & Citrus) |
| [../.cursor/commands/zai-handoff-mews-timeline-desk.md](../.cursor/commands/zai-handoff-mews-timeline-desk.md) | z.ai Round 2 — Timeline desk brief (ERP Timeline largely shipped via calendar plan) |
| [../README.md](../README.md) | Project quick start |
| [../design/mockups/README.md](../design/mockups/README.md) | UX mockup index |
| [../scripts/bank-recon/README.md](../scripts/bank-recon/README.md) | Bhutan bank PDF → JSON recon |

## Latest product truth (2026-07-31)

- Desk IA: **9 modules** + `ModuleTabs` (Front desk includes dedicated **Check-out**)
- Check-in guest docs: dense **table** hybrid again
- POS open tickets: tap row → ticket detail panel
- Audit docs: WHITEBOARD, ERP-AUDIT, MULTI-TENANT-WHITELABEL, BTCL-ADAPTATION
- Public: Himalayan Dusk conversion rebuild; homepage hero only; room/food/spa/meeting/agent engines
- Search: sitemap, robots, canonicals, structured data, FAQ, Olakha guide, `llms.txt`
- Work PWA: unified login with desk/staff/agent routing and mobile footer tabs
- Desk palette: **Sky & Citrus** — sky-500 `#0ea5e9` + amber-500 `#f59e0b`
- Shell: `DeskShell` + shadcn **Sidebar**
- Calendar: `/erp/calendar` v1–v2 (plan `calendar_drag_booking_64bad6ba`)
- Settings: `/erp/settings`
- Plan source of truth for Cursor artifacts: `C:\Users\rajiv\.cursor\plans\` → mirrored in [PLANS.md](PLANS.md)