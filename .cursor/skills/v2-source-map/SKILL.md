---
name: v2-source-map
description: >-
  Merge / Copy / Reinvent doctrine for Hotel OS v2. Use before implementing any
  v2 module or copying from Innora web/ or root apps/*.
---

# v2 source map

Canonical: `docs/v2/SOURCE-MAP.md`.

| Verb | Do |
|---|---|
| MERGE | One module from best of many v1 paths — never keep parallel money/assign paths |
| COPY | Re-type into `v2/` with v1 file open; bring tests; **no** runtime import from `web/` or root `@hotel-os/*` |
| REINVENT | Schema, sync, folio-per-payer, assignment, checkout, offline drafts-only, agent masking |
| LEAVE OUT | `/erp/today` lab, `web/src/app/v2`, engine, thin Wave shells |
| MIGRATE | Data at cutover only |

Every PR cites a SOURCE-MAP row. Never port 15s snapshot, RAM money WAL, or client POS prices.
