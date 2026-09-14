# Documentation index

All Pelbu OS docs live in this folder (`C:\GitHub\pelbusuites\docs`).

| Doc | Purpose |
|-----|---------|
| [RELEASE-v1.md](RELEASE-v1.md) | **v1.0 release** — combined plans + what’s in / out of scope |
| [WHITEBOARD.md](WHITEBOARD.md) | **Live system map** — surfaces, ERP modules, hosting, known gaps |
| [ERP-AUDIT.md](ERP-AUDIT.md) | **International PMS fault register** + Phase A–C correction roadmap |
| [FEATURES.md](FEATURES.md) | **Shipped vs remaining** — modules, calendar, FO waves (canonical product truth) |
| [PLANS.md](PLANS.md) | **Cursor plans mirror** — every plan file → Done / residual / superseded |
| [FO-AGENT-COMMERCE-CHECKLIST.md](FO-AGENT-COMMERCE-CHECKLIST.md) | Bhutan agent FO: guide evidence, AR, room cap, competitive gaps |
| [GO-LIVE-TOMORROW.md](GO-LIVE-TOMORROW.md) | Day-1 shift guide by role |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | Cutover env + smoke (real initials) |
| [UAT-CHECKLIST.md](UAT-CHECKLIST.md) | Full go-live UAT before Excel cutover |
| [VERIFICATION.md](VERIFICATION.md) | Automated route/smoke/layout verification (Playwright) |
| [VERIFICATION-FAULTS.md](VERIFICATION-FAULTS.md) | Agent UAT fault register + advisor findings |
| [PLATFORM.md](PLATFORM.md) | Architecture, UX north stars, phases |
| [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md) | SaaS white-label, DNS/CNAME, Host → property |
| [BTCL-ADAPTATION.md](BTCL-ADAPTATION.md) | Multi-hotel chain adaptation (BTCL) |
| [FINANCE-UAT.md](FINANCE-UAT.md) | Period / GST / bank recon / edge journals |
| [OPS-RUNBOOK.md](OPS-RUNBOOK.md) | Night audit / payments / hosts / channel / FO digests |
| [PERF-BUDGET.md](PERF-BUDGET.md) | Free-tier caps, DNS first-load, Web Vitals budgets, ship gates |
| [CHANNEX-CERT.md](CHANNEX-CERT.md) | Live Channel certification |
| [GST-EINVOICE.md](GST-EINVOICE.md) | Bhutan DRC e-invoice stub vs live |
| [IMAGE_SERVER.md](IMAGE_SERVER.md) | Cloudinary + MCP |
| [CLAUDE.md](CLAUDE.md) | Claude agent handoff rules |
| [../AGENTS.md](../AGENTS.md) | Cursor / z.ai / Claude ownership |
| [../README.md](../README.md) | Project quick start |
| [../design/mockups/README.md](../design/mockups/README.md) | UX mockup index |
| [../scripts/bank-recon/README.md](../scripts/bank-recon/README.md) | Bhutan bank PDF → JSON recon |

## Latest product truth (2026-08-10)

- **Last full multi-doc documentation commit:** `fc23144` (2026-08-06 — StayHub walk-in). This index re-synced 2026-08-10 across FEATURES / WHITEBOARD / PLANS / OPS / UAT / FO agent checklist.
- **Release:** boutique single-hotel **v1.0** — [RELEASE-v1.md](RELEASE-v1.md)
- Desk palette: **Sky & Citrus**
- **Stay confirmation `PS-YYYY-#####`** · tax invoice **`INV-YYYY-####`** (folio issue only) — search `/erp/reservations` or **Ctrl+K**
- StayHub: Folio/POS first-class; agent guide pack leave + AR; open room cap
- Party reservations + rooming list; one Fast Book modal; guest Nu 0/5; bar packs
- Residuals: live Channex cert, Stripe SaaS, Phase C cost trends, SEC-01 client purge
- Plan mirror: `C:\Users\rajiv\.cursor\plans\` → [PLANS.md](PLANS.md)
