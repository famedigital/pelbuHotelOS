# Pelbu Suites

Hotel OS + conversion PWA for **Pelbu Suites** (Olakha, Thimphu).  
`template_id: 1` = flagship. Stack: Next.js · Vercel · Supabase · Resend · CallMeBot · Cloudinary.

## Quick start

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 — desk at `/erp/login` (`DESK_PIN`).

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/FEATURES.md](docs/FEATURES.md) | **What is shipped vs remaining** |
| [docs/PLATFORM.md](docs/PLATFORM.md) | Architecture + phased plan |
| [docs/UAT-CHECKLIST.md](docs/UAT-CHECKLIST.md) | Go-live UAT |
| [AGENTS.md](AGENTS.md) | Cursor / z.ai / Claude ownership |
| [scripts/bank-recon/README.md](scripts/bank-recon/README.md) | Bank statement parsers |
| [design/mockups/](design/mockups/) | UX references |

## Phase status (2026-07-29)

| Phase | Status |
|-------|--------|
| P0 Setup / mockups | Done |
| P1 Public PWA + CMS + fast book | Done |
| P2 Check-in, POS/KOT, folio | Done |
| P3 Agents + credit + rates | Done |
| P4 Finance + bank recon | Done |
| P5 HR / inventory / reports | Done |
| P5.5 Fast-book UX v2 + StayDatesField + guest_origin + partners | **Done (2026-07-29)** |
| P6 Channex + extra templates | **Partial** (foundation only) |
| P7 Night audit, voids, deposits | Done (provider APIs open) |

Not finished: Channex staging certification, live Pay.bt/QR webhooks, offline desk queue, partner perks, agent voucher PDF/email, multi-property UI polish. Details in [docs/FEATURES.md](docs/FEATURES.md).

## Desk routes

`/erp` · fast-book · check-in · pos · folios · agents · finance · partners · reports · rooms · inventory · hr · channel · night-audit
