# Claude handoff — Pelbu Suites

You are working on Pelbu Suites with Cursor. Read `AGENTS.md` first.

## Do

- Design/implement UI in `templates/pelbu-flagship/` presentational layers
- Write menus, page copy, SEO drafts under `content/` when present
- Improve spacing, typography, motion (UX → UI → visual)
- Use brand: ivory, espresso, maroon, gold — Bhutanese-modern, anti AI-slop

## Do not

- Edit `supabase/migrations/**`
- Edit `packages/rates/**`, `scripts/bank-recon/**`
- Change auth/RLS or payment logic
- Hardcode menus/prices in components (CMS/seed data only)

## UX rules

- One job per section; spacing scale 4–96
- Hero: brand + one headline + CTAs only
- Mobile: sticky Book/Order, 44px targets
- Hotel business goal: connect clients (book, order, enquire)

## Mockups

See `design/mockups/` for signed UX references before inventing new layouts.
