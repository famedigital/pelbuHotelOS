# Travel Agent OS — module catalog

Last updated: 2026-11-13

Status legend: `NOT_STARTED` · `R` · `R+D` · `IMPLEMENTING` · `TEST` · `PRODUCTION` · `BLOCKED`

| ID | Module | Layer | Depends | Status | Pack |
|----|--------|-------|---------|--------|------|
| M01 | Agency org, members, portal auth hardening | L0–L3 | — | **IMPLEMENTING** | [M01-agency-org](./modules/M01-agency-org/) |
| M02 | Share-tier projector + margin math | L0 | — | **PRODUCTION** | [M02-share-projector](./modules/M02-share-projector/) |
| M03 | Guide pool (agency-owned) | L1–L3 | M01 | NOT_STARTED | — |
| M04 | Driver + vehicle pool | L1–L3 | M01 | NOT_STARTED | — |
| M05 | Trip spine (trip + days) | L1–L3 | M01 | NOT_STARTED | — |
| M06 | Trip stays → Innora hold | L2–L3 | M05, M01 | NOT_STARTED | — |
| M07 | Trip staff assign | L2–L3 | M05, M03, M04 | NOT_STARTED | — |
| M08 | Budget & profit margin | L1–L3 | M05, M02 | NOT_STARTED | — |
| M09 | Doc vault + PDF generators | L1–L3 | M05 | NOT_STARTED | — |
| M10 | Share links issue/revoke/open | L1–L3 | M02, M05 | NOT_STARTED | — |
| M11 | Guide + Driver companions | L3 | M07, M10 | NOT_STARTED | — |
| M12 | Public gateway site | L3 | login routes | NOT_STARTED | — |

## Integration waves (do not start early)

| Wave | Layer | Requires modules PRODUCTION | Status |
|------|-------|------------------------------|--------|
| W1 Organism | L5 | M01–M10 | NOT_STARTED |
| W2 Community | L6 | W1 + M11 | NOT_STARTED |
| W3 Society | L7 | W2 + M12 | NOT_STARTED |
| W4 Country (Hotel OS) | L8 | W1 + M06 live holds proven | NOT_STARTED |
| W5 Network | L9 | W4 + multi-property MoU | NOT_STARTED |

## Next action

1. Review/approve M01 + M02 R+D.  
2. Say **implement M01** (or revise packs).  
3. Do not open M03 R+D until M01 Implement is underway or complete — unless writing R-only drafts in parallel is explicitly requested.
