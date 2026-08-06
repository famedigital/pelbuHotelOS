# Documentation index

All Pelbu OS docs live in this folder (`C:\GitHub\pelbusuites\docs`).

| Doc | Purpose |
|-----|---------|
| [RELEASE-v1.md](RELEASE-v1.md) | **v1.0 release** — combined plans + what’s in / out of scope |
| [WHITEBOARD.md](WHITEBOARD.md) | **Live system map** — surfaces, ERP modules, hosting, known gaps |
| [ERP-AUDIT.md](ERP-AUDIT.md) | **International PMS fault register** + Phase A–C correction roadmap |
| [FEATURES.md](FEATURES.md) | **Shipped vs remaining** — modules, calendar, phases |
| [PLANS.md](PLANS.md) | **Cursor plans mirror** — every plan file → Done / residual / superseded |
| [GO-LIVE-TOMORROW.md](GO-LIVE-TOMORROW.md) | Day-1 shift guide by role |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | Cutover env + smoke (real initials) |
| [UAT-CHECKLIST.md](UAT-CHECKLIST.md) | Full go-live UAT before Excel cutover |
| [PLATFORM.md](PLATFORM.md) | Architecture, UX north stars, phases |
| [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md) | SaaS white-label, DNS/CNAME, Host → property |
| [BTCL-ADAPTATION.md](BTCL-ADAPTATION.md) | Multi-hotel chain adaptation (BTCL) |
| [FINANCE-UAT.md](FINANCE-UAT.md) | Period / GST / bank recon / edge journals |
| [OPS-RUNBOOK.md](OPS-RUNBOOK.md) | Night audit / payments / hosts / channel ops |
| [CHANNEX-CERT.md](CHANNEX-CERT.md) | Live Channel certification |
| [GST-EINVOICE.md](GST-EINVOICE.md) | Bhutan DRC e-invoice stub vs live |
| [IMAGE_SERVER.md](IMAGE_SERVER.md) | Cloudinary + MCP |
| [CLAUDE.md](CLAUDE.md) | Claude agent handoff rules |
| [../AGENTS.md](../AGENTS.md) | Cursor / z.ai / Claude ownership |
| [../README.md](../README.md) | Project quick start |
| [../design/mockups/README.md](../design/mockups/README.md) | UX mockup index |
| [../scripts/bank-recon/README.md](../scripts/bank-recon/README.md) | Bhutan bank PDF → JSON recon |

## Latest product truth (2026-08-06 — v1.0 + StayHub walk-in)

- **Release:** boutique single-hotel **v1.0** — [RELEASE-v1.md](RELEASE-v1.md)
- Desk palette: **Sky & Citrus** — sky-500 `#0ea5e9` + amber-500 `#f59e0b`
- Shell: `DeskShell` + shadcn **Sidebar**; Groups under **Front desk**
- Calendar: `/erp/calendar` rack (density, stay colors, connecting rooms, virtualization)
- **StayHub walk-in (2026-08-06):** phone later · fast identity auto-save · sticky Confirm check-in · undo check-in · cancel/no-show on CI — [FEATURES.md § StayHub](FEATURES.md) · commit `8ba9342`
- Agents: `/erp/agents/[id]` dossier · Reports catalog at `/erp/reports`
- Money: folio gateways, night-audit cron + `close_time`, fiscal INV/RCP/CN
- Public: Himalayan Dusk conversion + `/book` hold funnel
- Post-v1 residuals: live Channex cert, Stripe SaaS, Phase C purchase-cost trends, full AuthZ purge
- Plan mirror: `C:\Users\rajiv\.cursor\plans\` → [PLANS.md](PLANS.md)
