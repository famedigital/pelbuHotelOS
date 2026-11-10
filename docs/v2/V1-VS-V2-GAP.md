# Innora v1 vs clean `v2/` — gap register

> Remapped 2026-11-08 to the **31-module** catalogue. Root Wave `apps/*` is a **legacy experiment**, not the target.

| Legend | Meaning |
|---|---|
| **Present** | In Innora v1 production paths |
| **Wave** | Partial / buggy in root `apps/*` — do not port blindly |
| **Target** | Specified in [MODULES.md](./MODULES.md); built under top-level `v2/` |
| **Missing** | Not started in `v2/` |

## Front office

| Capability | Innora v1 | Root Waves | Clean `v2/` |
|---|---|---|---|
| Desk today board | Present | Wave (snapshot bugs historically) | Target — Wave B |
| Reservations + Fast Book | Present (many paths) | Wave partial | Target MERGE — Wave B |
| StayView assign/move | Present (4 paths) | Wave DnD | Target REINVENT — Wave B |
| Groups / rooming | Present partial | Missing | Target — Wave B |
| Guests + docs | Present | Partial | Target — Wave B |
| Night audit | Present | Wave via core | Target REINVENT pipeline — Wave B |
| StayHub only editor | Present | Wave drawer | Target — Wave B |

## Money

| Capability | Innora v1 | Root Waves | Clean `v2/` |
|---|---|---|---|
| Folio per payer | Missing (shared folio) | Missing | Target REINVENT — Wave C |
| PSBN / INV gapless | Partial / dual series | Partial | Target — Wave C |
| SC→GST + 3 modes | Partial / buggy toggles | Via core | Target COPY+FIX — Phase 2 / Wave A |
| Offline money | Restricted after fixes | Banned in WAL | Target: drafts only |

## Ops / F&B / partners / growth

Design program (spec → sell path → kitchen ops): [`docs/superpowers/specs/2026-11-08-pos-fnb-dept-design.md`](../superpowers/specs/2026-11-08-pos-fnb-dept-design.md).

| Area | Innora | Waves | Clean `v2/` |
|---|---|---|---|
| POS server prices + recipe stock | Partial | Client/partial | Target REINVENT — Wave D |
| KDS unified | Fragmented | Partial | Target MERGE — Wave D |
| HK / Laundry | Present | Partial | Target MERGE — Wave D |
| Agents + masked portal | Present / weak mask | Partial | Target REINVENT — Wave E |
| Channel Channex | Partial | Partial | Target — Wave E |
| CMS / Website / Marketing / AI | Present in web | Lab | Target INCLUDED — Wave G |
| Events / Services | Thin | Missing | Target — Wave H |

## Separation

| Item | Status |
|---|---|
| Schema `v2` + role `v2_app` | Target — ADR 001; Phase 2 migrations in `v2/packages/db` |
| No runtime import from `web/` | Enforced in `v2/` README + CI grep |
| `V2_DESK_CUTOVER` | **false** until Wave H shadow |

Update this file at the end of every wave.
