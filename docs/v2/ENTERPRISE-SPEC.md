# Hotel OS Bhutan v2 — Enterprise specification

**Document version:** 3.0.0-CLEAN  
**Date:** November 2026  
**Classification:** Product architecture pointing at the clean `v2/` rebuild

---

## Read this first

| Fact | Detail |
|---|---|
| Canonical modules | **[`MODULES.md`](./MODULES.md)** — 31 deep modules |
| Build doctrine | **[`SOURCE-MAP.md`](./SOURCE-MAP.md)** — Merge / Copy / Reinvent / Leave out / Migrate |
| UX + visual | [`UX-GUARDRAILS.md`](./UX-GUARDRAILS.md) · [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) Glacier Glass v2.1 |
| Journeys | [`OPERATIONS-FLOW.md`](./OPERATIONS-FLOW.md) |
| Agent portal (legacy) | [`AGENT-PORTAL.md`](./AGENT-PORTAL.md) — prefer Travel Agent OS docs |
| Travel Agent OS | [`travel-agent-os/README.md`](./travel-agent-os/README.md) · [`CATALOG.md`](./travel-agent-os/CATALOG.md) |
| Schema ADR | [`adr/001-separate-v2-schema.md`](./adr/001-separate-v2-schema.md) · [`adr/002-travel-agent-os.md`](./adr/002-travel-agent-os.md) |
| Status | [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) |
| Cutover | [`CUTOVER.md`](./CUTOVER.md) — `V2_DESK_CUTOVER` stays false until shadow |
| Live FO | Innora `web/` — **not** root Wave `apps/*` |
| Code home | Top-level `v2/` only |

This file is the **executive index**. Do not implement from the old Wave "17 surfaces / RAM engine" narrative — that produced thin buggy pages. Implement from MODULES + SOURCE-MAP.

---

## Product shape

- Separate product: Vite desk + Fastify API + Next public site
- Data: schema `v2` on existing Supabase; role `v2_app`; no `public` grants
- Tax: SC 10% then GST 5% on (base+SC), per property
- Invoices: `PSBN-YYYY-NNNNN` room/stay; `INV-YYYY-NNNN` F&B; `PS-` confirmation only; gapless
- Commands within a module; events between modules; Realtime fan-out; folio **per payer**; net-only rates
- **Innora Bot (Hermes):** canonical Telegram ops surface (`/telegram` desk + `hermes.*` API). One bot per product — pairing, OCR drafts, role/agent alerts, department topics. Extend Hermes; do not invent a second bot. Notify/ack only for money; ledger stays on atomic desk/API commands.

## Competitive bar

Mid-market cloud PMS (Mews/Cloudbeds) + Bhutan depth: SDF, DOT/immigration, RRCO GST, guide/driver, mBoB, SC tip pool. Channel = Channex + national marketplace (not full OTA sprawl).

## Definition of done (product)

See Claude plan §15 scorecard and the 8-point module-done gate in [`IMPLEMENTATION.md`](./IMPLEMENTATION.md). Hollow routes = plan failure.
