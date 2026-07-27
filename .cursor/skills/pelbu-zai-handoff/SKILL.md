---
name: pelbu-zai-handoff
description: >-
  Split work between Cursor (architect) and z.ai/GLM (implementer) to cut Cursor
  token spend. Use when planning handoffs, writing briefs, or reviewing z.ai diffs.
---

# Cursor ↔ z.ai handoff

## Roles

| Role | Model | Does |
|------|--------|------|
| Architect / reviewer | Cursor default (this chat) | Spec, schema, security, review, hard bugs |
| Implementer | z.ai GLM (`GLM-5.2` / `GLM-4.7` / air) | UI, forms polish, boilerplate in allowed files |

## Workflow

1. **Cursor** writes a brief via `/zai-handoff` (files, acceptance, do-not-touch).
2. User opens a **second chat**, selects GLM model, pastes brief + `@` rules.
3. **z.ai** implements only listed files.
4. **Cursor** reviews diff (`git diff`), fixes schema/auth issues, does not rewrite whole feature unless broken.

## Token strategy

- Prefer z.ai for volume (pages, components, copy wiring).
- Keep Cursor for: migrations, RLS, server actions that touch money/auth, production incidents.
- Short Cursor reviews beat long Cursor rewrite sessions.

## Never

- Two agents editing the same files without a branch split (`cursor/*` vs `zai/*`).
- z.ai inventing migrations or env vars.
