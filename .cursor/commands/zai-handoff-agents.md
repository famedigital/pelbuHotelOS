# Handoff brief for z.ai — agents apply page polish

Paste into a **new chat** with model `GLM-5.2`. Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

## Task
Polish the `/agents` partner apply experience (copy, aside, success clarity). Do not change submit logic.

## Goal
Clear, trustworthy agent onboarding UI for Bhutan / Jaigaon / India partners.

## Allowed files
- `web/src/app/agents/page.tsx` (shell copy / aside only)
- `web/src/components/agents/AgentApplyForm.tsx` (layout/copy/success only — keep field `name=` attributes identical)

## Do not touch
- `web/src/app/actions/agents.ts`
- `web/src/lib/notify.ts`
- `supabase/**`
- `.env*`

## Patterns to copy
- `web/src/components/book/BookingForm.tsx` success + CopyReference
- Brand tokens in `web/src/app/globals.css`
- `ConversionShell`

## Acceptance checks
- [ ] Markets remain bhutan / jaigaon / india
- [ ] Form still posts same field names
- [ ] Mobile readable; no purple/scaffold look
- [ ] `npm run build` in `web/` passes
- [ ] Brief “what changed / how to test”

## Done means
Cursor reviews the diff; do not merge or push unless asked.
