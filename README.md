# Pelbu Suites

Hotel OS + conversion PWA for **Pelbu Suites** (Olakha, Thimphu).  
`template_id: 1` = flagship. Stack: Next.js · Vercel · Supabase · Resend · CallMeBot · **Cloudinary (image MCP)**.

Docs live under [`docs/`](docs/) — see especially [`docs/IMAGE_SERVER.md`](docs/IMAGE_SERVER.md).

## Quick start

```bash
cd web
npm install
npm run dev
```

## Docs

- [AGENTS.md](AGENTS.md) — Cursor vs Claude ownership
- [docs/CLAUDE.md](docs/CLAUDE.md) — Claude handoff
- [design/mockups/](design/mockups/) — UX samples (review first)
- [supabase/migrations/](supabase/migrations/) — core schema draft

## Phase status

- [x] UX mockups (5 screens)
- [x] Skills / rules / AGENTS
- [x] Next.js scaffold (`web/`)
- [ ] Supabase project link + MCP auth (you approve in Cursor)
- [ ] Flagship public site implementation
