# Pelbu Suites

Hotel OS + conversion PWA for **Pelbu Suites** (Olakha, Thimphu).  
`template_id: 1` = flagship. Stack: Next.js · Vercel · Supabase · Resend · CallMeBot · Cloudinary.

**Release: [v1.0](docs/RELEASE-v1.md)** — single-hotel production-ready. Cutover: [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md).

## Quick start

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 — desk at `/erp/login` (`DESK_PIN` or staff Auth).

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/RELEASE-v1.md](docs/RELEASE-v1.md) | **v1.0** — combined plans + scope |
| [docs/FEATURES.md](docs/FEATURES.md) | What is shipped vs remaining |
| [docs/WHITEBOARD.md](docs/WHITEBOARD.md) | Live system map |
| [docs/GO-LIVE-TOMORROW.md](docs/GO-LIVE-TOMORROW.md) | Day-1 shift guide |
| [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md) | Cutover checklist |
| [docs/PLATFORM.md](docs/PLATFORM.md) | Architecture + phased plan |
| [docs/PLANS.md](docs/PLANS.md) | Cursor plans status mirror |
| [AGENTS.md](AGENTS.md) | Cursor / z.ai / Claude ownership |
| [scripts/bank-recon/README.md](scripts/bank-recon/README.md) | Bank statement parsers |
| [design/mockups/](design/mockups/) | UX references |

## Phase status (v1.0)

| Phase | Status |
|-------|--------|
| P0–P5 / P5.5–P5.6 / P7 | **Done** (boutique) |
| P6 Channel | Desk ARI **shipped**; live cert open |
| Post-v1 | Stripe SaaS, Phase C cost trends, full AuthZ purge, Mews Enterprise catalog |

Never commit `.env*` or `.tmp/` scratch dumps.
